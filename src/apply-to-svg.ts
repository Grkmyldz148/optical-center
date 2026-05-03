/**
 * Apply a viewBox transform to an SVG string. Surgical: only the root
 * `<svg>` opening tag is rewritten — everything else (path data,
 * formatting, comments) is preserved byte-for-byte.
 *
 * Used by the CLI and the Vite asset transform; the Babel plugin runs at
 * the AST level instead, so it never visits this function.
 */

import type { ViewBoxBreadcrumb } from './types.js';

export interface SvgTransformPatch {
  readonly viewBox: string;
  readonly breadcrumb: ViewBoxBreadcrumb;
}

const SVG_OPENING = /<svg\b([^>]*)>/i;

/**
 * Return a new SVG string with `viewBox` replaced and breadcrumb
 * attributes merged onto the root `<svg>` tag. Idempotent: re-running with
 * the same patch produces the same output, regardless of whether the
 * attributes were already present.
 */
export function applyTransformToSvg(
  svg: string,
  patch: SvgTransformPatch,
): string {
  const match = svg.match(SVG_OPENING);
  if (!match) {
    throw new Error('Cannot apply transform: no <svg> opening tag found.');
  }

  let attrs = match[1] ?? '';
  attrs = upsertAttribute(attrs, 'viewBox', patch.viewBox);

  for (const [name, value] of Object.entries(patch.breadcrumb)) {
    if (value === undefined) continue;
    attrs = upsertAttribute(attrs, name, value);
  }

  return svg.replace(match[0], `<svg${attrs}>`);
}

function upsertAttribute(attrs: string, name: string, value: string): string {
  const escapedName = name.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
  const pattern = new RegExp(`\\s${escapedName}\\s*=\\s*"[^"]*"`, 'i');

  if (pattern.test(attrs)) {
    return attrs.replace(pattern, ` ${name}="${value}"`);
  }
  if (new RegExp(`\\s${escapedName}\\s*=\\s*'[^']*'`, 'i').test(attrs)) {
    return attrs.replace(
      new RegExp(`\\s${escapedName}\\s*=\\s*'[^']*'`, 'i'),
      ` ${name}="${value}"`,
    );
  }
  // Boolean attribute (no value) — replace with a quoted form for safety.
  if (new RegExp(`\\s${escapedName}(?=\\s|/?>|$)`, 'i').test(attrs)) {
    return attrs.replace(
      new RegExp(`\\s${escapedName}(?=\\s|/?>|$)`, 'i'),
      ` ${name}="${value}"`,
    );
  }

  const trimmed = attrs.trimEnd();
  return `${trimmed} ${name}="${value}"`;
}
