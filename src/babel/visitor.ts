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
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { rasterizeSvg } from '../node/rasterize.js';
import { getOpticalCenter } from '../model/final-model.js';
import { transformViewBox } from '../core/transform-viewbox.js';
import type { ViewBoxBreadcrumb } from '../core/types.js';
import type { WarningCode } from '../core/warnings.js';

import { jsxElementToSvgString } from './jsx-to-svg.js';
import { SyncTransformCache } from './sync-cache.js';

/**
 * Map a PascalCase icon-component name to a bare specifier resolvable
 * via Node's module resolution. Same shape the PostCSS scanner uses
 * so the two plugins stay aligned on which packages they understand.
 */
export type IconPackageResolver = (componentName: string) => string;

const DEFAULT_ICON_PACKAGES: Readonly<Record<string, IconPackageResolver>> = {
  'lucide-react': (name) => `lucide-static/icons/${pascalToKebab(name)}.svg`,
};

function pascalToKebab(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Per-file map from a JSX local name (`Play`) to the absolute path
 * of its source SVG (`lucide-static/icons/play.svg`). The Babel
 * plugin builds this once per file in a Program-enter pass and
 * passes it into every JSXElement visit.
 */
export interface IconImports {
  readonly components: ReadonlyMap<string, string>;
}

export const EMPTY_ICON_IMPORTS: IconImports = { components: new Map() };

export function scanIconImports(
  program: t.Program,
  filename: string | undefined,
  packages: Readonly<Record<string, IconPackageResolver>> = DEFAULT_ICON_PACKAGES,
): IconImports {
  const components = new Map<string, string>();
  const baseDir = filename ? dirname(filename) : process.cwd();
  const req = createRequire(join(baseDir, '_optical_center_resolver'));
  const resolveSvg = (specifier: string): string | null => {
    try {
      return req.resolve(specifier);
    } catch {
      return null;
    }
  };

  for (const stmt of program.body) {
    if (!t.isImportDeclaration(stmt)) continue;
    const resolver = packages[stmt.source.value];
    if (!resolver) continue;
    for (const spec of stmt.specifiers) {
      if (!t.isImportSpecifier(spec)) continue;
      const importedName = t.isIdentifier(spec.imported)
        ? spec.imported.name
        : spec.imported.value;
      if (!/^[A-Z]/.test(importedName)) continue;
      const svgSpecifier = resolver(importedName);
      const absolute = resolveSvg(svgSpecifier);
      if (!absolute) continue;
      components.set(spec.local.name, absolute);
    }
  }

  return { components };
}

export interface CachedTransform {
  readonly viewBox: string;
  readonly breadcrumb: ViewBoxBreadcrumb;
  readonly clipDetected: boolean;
}

interface OpticalNode extends t.JSXElement {
  _opticalProcessed?: boolean;
}

export interface VisitorOptions {
  readonly emitMetadata: boolean;
  readonly onWarning?: (warning: { code: WarningCode; location?: string }) => void;
  /** Bail out before rasterizing anything larger than this many bytes. */
  readonly maxInputBytes?: number;
  /**
   * Optional sync cache shared across the plugin lifetime. When
   * provided, repeated icons (the same SVG appearing in many JSX
   * files) skip the rasterizer entirely on hit.
   */
  readonly cache?: SyncTransformCache<CachedTransform>;
  /**
   * Map of icon component local names to their source SVG paths,
   * built per file from the import statements. When `<div
   * optical-center="auto"><Play /></div>` is encountered, the
   * container directive resolves `<Play />` against this map and
   * computes the perceptual translate from `play.svg` at compile
   * time. Defaults to an empty map.
   */
  readonly iconImports?: IconImports;
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
  if (!t.isJSXIdentifier(opening.name, { name: 'svg' })) {
    // Container-side: `optical-center="auto"` lives on a wrapper JSX
    // element. Whatever the icon child is — a hand-written `<svg>`,
    // or an imported icon component like `<Play />` — Babel ALSO
    // injects an inline-style centering block so the wrapper doesn't
    // need an extra CSS class. No align-items / justify-content;
    // we use `display: flex` on the wrapper + `margin: auto` on the
    // icon (well-known flex auto-margin trick).
    propagateContainerDirective(node, options);
    return;
  }

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

  // Accept either the idiomatic JSX camelCase prop (opticalCenter) or
  // the kebab-case form (optical-center) that mirrors the CSS / HTML
  // syntax exactly. Same semantics either way.
  const opticalAttr =
    findAttribute(opening.attributes, 'opticalCenter') ??
    findAttribute(opening.attributes, 'optical-center');
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
  if (options.maxInputBytes !== undefined && svg.length > options.maxInputBytes) {
    emitWarning(options, 'OPTICAL_RASTERIZE_FAILED', path);
    node._opticalProcessed = true;
    return;
  }

  let viewBox: string;
  let breadcrumb: ViewBoxBreadcrumb;
  let clipDetected = false;
  // Breadcrumb shape depends on emitMetadata, so we tag the cache key
  // with the flag — same SVG with different emit modes coexist as
  // separate entries.
  const cacheTag = `meta:${options.emitMetadata ? '1' : '0'}\n${svg}`;
  const cached = options.cache?.get(cacheTag).value ?? null;
  if (cached) {
    viewBox = cached.viewBox;
    breadcrumb = cached.breadcrumb;
    clipDetected = cached.clipDetected;
  } else {
    try {
      const raster = rasterizeSvg(svg);
      const px = getOpticalCenter(raster);
      const offset = {
        dxPercent: raster.width > 0 ? (px.dx / raster.width) * 100 : 0,
        dyPercent: raster.height > 0 ? (px.dy / raster.height) * 100 : 0,
      };
      const result = transformViewBox(svg, raster, offset, {
        emitMetadata: options.emitMetadata,
      });
      viewBox = result.viewBox;
      breadcrumb = result.breadcrumb;
      clipDetected = result.clipDetected;
      options.cache?.set(cacheTag, {
        viewBox,
        breadcrumb,
        clipDetected,
      });
    } catch {
      emitWarning(options, 'OPTICAL_RASTERIZE_FAILED', path);
      node._opticalProcessed = true;
      return;
    }
  }

  // 4. Commit — mutate the AST ----------------------------------------
  opening.attributes = opening.attributes.filter((a) => {
    if (!t.isJSXAttribute(a)) return true;
    if (!t.isJSXIdentifier(a.name)) return true;
    return a.name.name !== 'opticalCenter' && a.name.name !== 'optical-center';
  });
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

interface SvgIconChild {
  readonly kind: 'svg';
  readonly element: t.JSXElement;
}
interface ComponentIconChild {
  readonly kind: 'component';
  readonly element: t.JSXElement;
  readonly svgPath: string;
}
type IconChild = SvgIconChild | ComponentIconChild;

/**
 * Handle `optical-center` / `opticalCenter` on a non-SVG wrapper.
 *
 *   <div optical-center="auto"><Play /></div>
 *   <div optical-center="auto"><svg>…</svg></div>
 *
 * Two paths depending on the icon child:
 *
 *   - Hand-written `<svg>`: copy the directive down to the SVG so the
 *     SVG-side branch of `visitJsxElement` rewrites its viewBox. No
 *     translate is needed — the perceptual shift goes into the asset.
 *
 *   - Imported icon component (`<Play />` from `lucide-react`, etc.):
 *     read the source SVG out of the package at compile time, run the
 *     same offset pipeline, and inject `translate: dx% dy%` as an
 *     inline style on the component. React forwards it through to
 *     the rendered SVG.
 *
 * In BOTH cases the wrapper picks up `style={{ display: 'flex' }}` and
 * the icon picks up `style={{ margin: 'auto' }}` — the well-known
 * flex auto-margin centering trick. We never emit `align-items:
 * center` or `justify-content: center`; those are the properties the
 * directive is supposed to replace.
 *
 * Bails silently when the wrapper has spread attributes (unknowable
 * shape), when there's no directive, or when no icon child is
 * present. If the wrapper already has a `style` attribute we skip
 * the auto-injection so the user's style isn't clobbered.
 */
function propagateContainerDirective(
  node: t.JSXElement,
  options: VisitorOptions,
): void {
  const opening = node.openingElement;
  for (const attr of opening.attributes) {
    if (t.isJSXSpreadAttribute(attr)) return;
  }

  const opticalAttr =
    findAttribute(opening.attributes, 'opticalCenter') ??
    findAttribute(opening.attributes, 'optical-center');
  if (!opticalAttr) return;

  const iconChild = findFirstIconChild(node, options.iconImports ?? EMPTY_ICON_IMPORTS);
  if (!iconChild) {
    // Strip the directive so it doesn't leak into the DOM as an
    // unknown attribute. Centering CSS would be a no-op anyway with
    // no icon to center.
    opening.attributes = opening.attributes.filter((a) => a !== opticalAttr);
    return;
  }

  const childStyle: Record<string, string> = { margin: 'auto' };

  if (iconChild.kind === 'svg') {
    // Propagate the directive to the SVG so the SVG-side branch
    // rewrites its viewBox. We don't compute translate here — the
    // perceptual shift goes into the asset.
    const existing =
      findAttribute(iconChild.element.openingElement.attributes, 'opticalCenter') ??
      findAttribute(iconChild.element.openingElement.attributes, 'optical-center');
    if (!existing) {
      iconChild.element.openingElement.attributes.push(
        t.jsxAttribute(t.jsxIdentifier('opticalCenter'), t.stringLiteral('auto')),
      );
    }
  } else {
    // Component path: rasterize the package's source SVG, compute
    // the offset, emit it as a translate the component will receive
    // through its style prop. React forwards style to the underlying
    // `<svg>`, so the perceptual shift lands on the right element.
    const translate = computeTranslateForSvgFile(iconChild.svgPath, options);
    if (translate) {
      childStyle['translate'] = translate;
    }
  }

  injectInlineStyle(opening, { display: 'flex' });
  injectInlineStyle(iconChild.element.openingElement, childStyle);

  // Strip the directive from the wrapper and leave a tracer attribute
  // so DevTools can see which wrappers went through the pipeline.
  opening.attributes = opening.attributes.filter((a) => a !== opticalAttr);
  upsertAttribute(opening, 'data-optical-center', '');
}

function findFirstIconChild(
  node: t.JSXElement,
  imports: IconImports,
): IconChild | null {
  for (const child of node.children) {
    if (!t.isJSXElement(child)) continue;
    const name = child.openingElement.name;
    if (t.isJSXIdentifier(name)) {
      if (name.name === 'svg') return { kind: 'svg', element: child };
      const svgPath = imports.components.get(name.name);
      if (svgPath) return { kind: 'component', element: child, svgPath };
    }
    const nested = findFirstIconChild(child, imports);
    if (nested) return nested;
  }
  return null;
}

function computeTranslateForSvgFile(
  svgPath: string,
  options: VisitorOptions,
): string | null {
  let svg: string;
  try {
    svg = readFileSync(svgPath, 'utf8');
  } catch {
    return null;
  }
  if (options.maxInputBytes !== undefined && svg.length > options.maxInputBytes) {
    return null;
  }
  try {
    const raster = rasterizeSvg(svg);
    const px = getOpticalCenter(raster);
    const dx = raster.width > 0 ? (px.dx / raster.width) * 100 : 0;
    const dy = raster.height > 0 ? (px.dy / raster.height) * 100 : 0;
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return null;
    return `${formatPercent(dx)} ${formatPercent(dy)}`;
  } catch {
    return null;
  }
}

function formatPercent(n: number): string {
  return `${n.toFixed(4).replace(/\.?0+$/, '')}%`;
}

function injectInlineStyle(
  opening: t.JSXOpeningElement,
  styles: Record<string, string>,
): void {
  const existing = findAttribute(opening.attributes, 'style');
  if (existing && existing.value) {
    // User-controlled style is sacrosanct. We don't try to merge —
    // doing so safely (object/spread/variable, conditional values)
    // is its own rabbit hole. Skipping here means the consumer keeps
    // full control but has to recreate the auto-injected styles by
    // hand if they want both.
    return;
  }
  const properties = Object.entries(styles).map(([key, value]) =>
    t.objectProperty(t.identifier(key), t.stringLiteral(value)),
  );
  opening.attributes.push(
    t.jsxAttribute(
      t.jsxIdentifier('style'),
      t.jsxExpressionContainer(t.objectExpression(properties)),
    ),
  );
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
      if (t.isJSXEmptyExpression(expr)) return FAIL_DYNAMIC;
      if (!isStaticExpression(expr)) return FAIL_DYNAMIC;
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

/**
 * "Static" for the purposes of the visitor's read-only compute phase
 * means the value is fully resolvable at compile time without
 * evaluating any expression. Plain literals, of course — but also
 * object literals whose properties are themselves static (so an
 * inline `style={{ margin: 'auto' }}` injected by the
 * container-side path still counts as static and doesn't cause the
 * surrounding SVG to bail with `OPTICAL_DYNAMIC_SVG`).
 */
function isStaticExpression(expr: t.Expression): boolean {
  if (t.isStringLiteral(expr)) return true;
  if (t.isNumericLiteral(expr)) return true;
  if (t.isBooleanLiteral(expr)) return true;
  if (t.isObjectExpression(expr)) {
    for (const prop of expr.properties) {
      if (!t.isObjectProperty(prop)) return false;
      if (prop.computed) return false;
      const value = prop.value;
      if (!t.isExpression(value)) return false;
      if (!isStaticExpression(value)) return false;
    }
    return true;
  }
  return false;
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
