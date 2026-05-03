/**
 * SVG viewBox parsing.
 *
 * Spec: https://www.w3.org/TR/SVG11/coords.html#ViewBoxAttribute
 *
 * The viewBox value is "min-x min-y width height" with separators that may
 * be whitespace, commas, or both. We also derive a viewBox from `width`/
 * `height` attributes when no `viewBox` is present, and fall back to a
 * 0 0 100 100 box as a last resort so the rest of the pipeline can still
 * produce meaningful percentages.
 */

import type { ViewBoxNumeric } from './types.js';

const DEFAULT_VIEWBOX: ViewBoxNumeric = { x: 0, y: 0, w: 100, h: 100 };

export type ViewBoxSource = 'attribute' | 'derived' | 'default';

export interface ParsedSvgViewBox {
  readonly viewBox: ViewBoxNumeric;
  readonly source: ViewBoxSource;
}

/**
 * Parse a raw `"x y w h"` value into a numeric viewBox.
 * Returns `null` for malformed input or non-positive dimensions.
 */
export function parseViewBoxString(value: string): ViewBoxNumeric | null {
  const parts = value.trim().split(/[\s,]+/);
  if (parts.length !== 4) return null;

  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;

  const [x, y, w, h] = nums as [number, number, number, number];
  if (w <= 0 || h <= 0) return null;

  return { x, y, w, h };
}

/**
 * Extract the effective viewBox from an SVG string.
 *
 * Resolution order:
 *   1. `viewBox="x y w h"` on the root `<svg>` (source: 'attribute').
 *   2. `width`/`height` numeric attributes → `(0, 0, w, h)` (source: 'derived').
 *   3. `(0, 0, 100, 100)` (source: 'default').
 *
 * Only the root `<svg>` tag is inspected; nested `<svg>` elements are ignored
 * because the optical-center pipeline targets the outermost coordinate system.
 */
export function parseViewBoxFromSvg(svg: string): ParsedSvgViewBox {
  const svgMatch = svg.match(/<svg\b([^>]*)>/i);
  if (!svgMatch) return { viewBox: DEFAULT_VIEWBOX, source: 'default' };

  const attrs = svgMatch[1] ?? '';

  const viewBoxMatch = attrs.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBoxMatch?.[1]) {
    const parsed = parseViewBoxString(viewBoxMatch[1]);
    if (parsed) return { viewBox: parsed, source: 'attribute' };
  }

  const widthMatch = attrs.match(/\bwidth\s*=\s*["']?([\d.]+)/i);
  const heightMatch = attrs.match(/\bheight\s*=\s*["']?([\d.]+)/i);
  if (widthMatch?.[1] && heightMatch?.[1]) {
    const w = Number(widthMatch[1]);
    const h = Number(heightMatch[1]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { viewBox: { x: 0, y: 0, w, h }, source: 'derived' };
    }
  }

  return { viewBox: DEFAULT_VIEWBOX, source: 'default' };
}

/**
 * Format a numeric viewBox as `"x y w h"` with up to 4 decimal places, with
 * trailing zeros and trailing dots stripped. Stable across runs (deterministic
 * cache keys).
 */
export function formatViewBox(vb: ViewBoxNumeric): string {
  return [vb.x, vb.y, vb.w, vb.h].map(formatNumber).join(' ');
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4).replace(/\.?0+$/, '');
}
