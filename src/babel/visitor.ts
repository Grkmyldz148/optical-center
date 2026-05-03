/**
 * JSXElement visitor — the heart of the Babel plugin.
 *
 * Lifecycle for each `<svg opticalCenter>` node:
 *
 *   1. Identify         — root tag is `<svg>`, no spread attrs, opticalCenter
 *                         attribute resolves statically to a truthy value.
 *   2. Validate         — every descendant, attribute, and child is static.
 *                         Any dynamic shape triggers a bail-out warning.
 *   3. Compute (RO)     — serialize JSX → SVG string, rasterize, run the
 *                         pipeline, calculate the new viewBox. Pure: zero
 *                         AST mutation. If anything throws we bail out and
 *                         the original AST is untouched.
 *   4. Commit           — strip the opticalCenter attribute, replace viewBox,
 *                         add data-optical-center (and optional metadata).
 *                         Mark `_opticalProcessed = true` so re-running the
 *                         pass is a no-op.
 *
 * Two-phase design (security F6): the read-only compute phase runs to
 * completion before any AST mutation. A native crash in resvg or any other
 * thrown error leaves the source AST exactly as the visitor found it.
 */

import * as t from '@babel/types';
import type { NodePath } from '@babel/core';

import { rasterizeSvg } from '../node/rasterize.js';
import { getOpticalCenter } from '../final-model.js';
import { transformViewBox } from '../transform-viewbox.js';
import type { ViewBoxBreadcrumb } from '../types.js';
import type { WarningCode } from '../warnings.js';

import { jsxElementToSvgString } from './jsx-to-svg.js';

interface OpticalNode extends t.JSXElement {
  _opticalProcessed?: boolean;
}

export interface VisitorOptions {
  readonly emitMetadata: boolean;
  readonly onWarning?: (warning: { code: WarningCode; location?: string }) => void;
}

interface ValidationOk {
  readonly ok: true;
}
interface ValidationFail {
  readonly ok: false;
  readonly reason: WarningCode;
}
type ValidationResult = ValidationOk | ValidationFail;

const FAIL_DYNAMIC: ValidationFail = { ok: false, reason: 'OPTICAL_DYNAMIC_SVG' };
const FAIL_SPREAD: ValidationFail = { ok: false, reason: 'OPTICAL_SPREAD_PROPS' };

export function visitJsxElement(
  path: NodePath<t.JSXElement>,
  options: VisitorOptions,
): void {
  const node = path.node as OpticalNode;
  if (node._opticalProcessed === true) return;

  // 1. Identify --------------------------------------------------------
  const opening = node.openingElement;
  if (!t.isJSXIdentifier(opening.name, { name: 'svg' })) return;

  for (const attr of opening.attributes) {
    if (t.isJSXSpreadAttribute(attr)) {
      // Spread attributes can hide opticalCenter — bail rather than guess.
      const opticalCenterPresent = false; // unknowable; treat as ambiguous
      void opticalCenterPresent;
      emitWarning(options, FAIL_SPREAD.reason, path);
      node._opticalProcessed = true;
      return;
    }
  }

  const opticalAttr = findAttribute(opening.attributes, 'opticalCenter');
  if (!opticalAttr) return;
  const enabled = readOpticalCenterValue(opticalAttr);
  if (enabled === 'disabled') return;
  if (enabled === 'dynamic') {
    emitWarning(options, FAIL_DYNAMIC.reason, path);
    node._opticalProcessed = true;
    return;
  }

  // 2. Validate the entire static subtree ------------------------------
  const validation = validateStatic(node);
  if (!validation.ok) {
    emitWarning(options, validation.reason, path);
    node._opticalProcessed = true;
    return;
  }

  // 3. Read-only compute ----------------------------------------------
  let svg: string;
  try {
    svg = jsxElementToSvgString(node);
  } catch {
    emitWarning(options, 'OPTICAL_DYNAMIC_SVG', path);
    node._opticalProcessed = true;
    return;
  }

  let viewBox: string;
  let breadcrumb: ViewBoxBreadcrumb;
  let clipDetected = false;
  try {
    const raster = rasterizeSvg(svg);
    const offset = getOpticalCenter(raster);
    const result = transformViewBox(svg, raster, offset, {
      emitMetadata: options.emitMetadata,
    });
    viewBox = result.viewBox;
    breadcrumb = result.breadcrumb;
    clipDetected = result.clipDetected;
  } catch {
    emitWarning(options, 'OPTICAL_RASTERIZE_FAILED', path);
    node._opticalProcessed = true;
    return;
  }

  // 4. Commit — mutate the AST ----------------------------------------
  opening.attributes = opening.attributes.filter(
    (a) => !(t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: 'opticalCenter' })),
  );
  upsertAttribute(opening, 'viewBox', viewBox);
  for (const [name, value] of Object.entries(breadcrumb)) {
    if (value === undefined) continue;
    upsertAttribute(opening, name, value);
  }
  if (clipDetected) {
    emitWarning(options, 'OPTICAL_CLIP_DETECTED', path);
  }

  node._opticalProcessed = true;
  path.skip();
}

function findAttribute(
  attributes: ReadonlyArray<t.JSXOpeningElement['attributes'][number]>,
  name: string,
): t.JSXAttribute | undefined {
  for (const attr of attributes) {
    if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name })) {
      return attr;
    }
  }
  return undefined;
}

type OpticalState = 'enabled' | 'disabled' | 'dynamic';

function readOpticalCenterValue(attr: t.JSXAttribute): OpticalState {
  if (attr.value === null) return 'enabled';
  if (t.isStringLiteral(attr.value)) {
    return attr.value.value === 'auto' ? 'enabled' : 'dynamic';
  }
  if (t.isJSXExpressionContainer(attr.value)) {
    const expr = attr.value.expression;
    if (t.isBooleanLiteral(expr)) return expr.value ? 'enabled' : 'disabled';
    if (t.isStringLiteral(expr)) return expr.value === 'auto' ? 'enabled' : 'dynamic';
    return 'dynamic';
  }
  return 'dynamic';
}

function validateStatic(node: t.JSXElement): ValidationResult {
  for (const attr of node.openingElement.attributes) {
    if (t.isJSXSpreadAttribute(attr)) return FAIL_SPREAD;
    if (
      attr.value !== null &&
      attr.value !== undefined &&
      t.isJSXExpressionContainer(attr.value)
    ) {
      const expr = attr.value.expression;
      if (
        !t.isStringLiteral(expr) &&
        !t.isNumericLiteral(expr) &&
        !t.isBooleanLiteral(expr)
      ) {
        return FAIL_DYNAMIC;
      }
    }
  }

  for (const child of node.children) {
    if (t.isJSXExpressionContainer(child)) return FAIL_DYNAMIC;
    if (t.isJSXFragment(child)) return FAIL_DYNAMIC;
    if (t.isJSXSpreadChild(child)) return FAIL_DYNAMIC;
    if (t.isJSXElement(child)) {
      const sub = validateStatic(child);
      if (!sub.ok) return sub;
    }
  }

  return { ok: true };
}

function upsertAttribute(
  opening: t.JSXOpeningElement,
  name: string,
  value: string,
): void {
  const existing = findAttribute(opening.attributes, name);
  const stringValue = t.stringLiteral(value);
  if (existing) {
    existing.value = stringValue;
    return;
  }
  opening.attributes.push(t.jsxAttribute(t.jsxIdentifier(name), stringValue));
}

function emitWarning(
  options: VisitorOptions,
  code: WarningCode,
  path: NodePath<t.JSXElement>,
): void {
  if (!options.onWarning) return;
  const loc = path.node.loc;
  const location = loc
    ? `${loc.start.line}:${loc.start.column}`
    : undefined;
  options.onWarning(
    location !== undefined ? { code, location } : { code },
  );
}
