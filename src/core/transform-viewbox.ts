/**
 * viewBox rewrite — turn an offset percentage into a coordinate-space shift
 * that visually centers the icon without touching CSS.
 *
 * Why viewBox and not CSS translate?
 *   - viewBox lives in SVG coordinate space, so user `transform`/`translate`,
 *     hover scale, and animations don't conflict.
 *   - DevTools shows the change once, in one place.
 *   - The transform is part of the asset, not the CSS pipeline.
 *
 * The math:
 *
 *   newX = X - (dxPercent / 100) * W
 *   newY = Y - (dyPercent / 100) * H
 *   newW = W   (only the window position moves)
 *   newH = H
 *
 * `dxPercent > 0` means "shift the visible content right". To achieve that,
 * the viewBox window slides LEFT — paths land relatively further right
 * inside the rendered box. See plan §"viewBox Rewrite Algorithm Contract"
 * for the full derivation.
 */

import { ALPHA_THRESHOLD } from './constants.js';
import { formatViewBox, parseViewBoxFromSvg } from './parse-viewbox.js';
import type { Bbox, RasterImage, ViewBoxBreadcrumb, ViewBoxNumeric } from './types.js';

/** Offset shape consumed by transformViewBox. */
export interface OpticalOffsetPercent {
  readonly dxPercent: number;
  readonly dyPercent: number;
}

export interface ViewBoxTransformOptions {
  /**
   * Include the `data-optical-original-viewbox` and `data-optical-offset`
   * breadcrumb attributes for DevTools inspection. Default `false`.
   *
   * Vite plugin opts in only during `command === 'serve'` — production
   * builds keep the breadcrumb minimal (security: avoid leaking dev-only
   * metadata into shipped HTML).
   */
  readonly emitMetadata?: boolean;
}

export interface ViewBoxTransformResult {
  /** New viewBox value as a `"x y w h"` string ready for an attribute. */
  readonly viewBox: string;
  /** HTML attributes to merge onto the root `<svg>` element. */
  readonly breadcrumb: ViewBoxBreadcrumb;
  /** Echo of the offset that produced this transform (informational). */
  readonly offset: OpticalOffsetPercent;
  /**
   * `true` if shifting the window pushes part of the rendered raster
   * outside the new viewBox. Caller decides what to do (warn, bail, pad).
   */
  readonly clipDetected: boolean;
}

/**
 * Compose a new viewBox + breadcrumb attributes from an SVG string,
 * its rasterized form, and the percentage offset.
 *
 * The function is pure — it does not parse the SVG into a DOM nor mutate
 * the input string. Callers (Babel plugin, Vite asset transform, CLI)
 * apply `result.viewBox` and `result.breadcrumb` themselves.
 */
export function transformViewBox(
  svg: string,
  raster: RasterImage,
  offset: OpticalOffsetPercent,
  options?: ViewBoxTransformOptions,
): ViewBoxTransformResult {
  const { viewBox: original, source } = parseViewBoxFromSvg(svg);
  const next = applyOffsetToViewBox(original, offset);
  const clipDetected = detectClipRiskFromRaster(raster, original, next);

  return {
    viewBox: formatViewBox(next),
    breadcrumb: buildBreadcrumb(original, offset, source, options?.emitMetadata === true),
    offset,
    clipDetected,
  };
}

/**
 * Apply a percentage offset to a viewBox. Pure function exposed so callers
 * can run the math without re-parsing the SVG.
 */
export function applyOffsetToViewBox(
  vb: ViewBoxNumeric,
  offset: OpticalOffsetPercent,
): ViewBoxNumeric {
  return {
    x: vb.x - (offset.dxPercent / 100) * vb.w,
    y: vb.y - (offset.dyPercent / 100) * vb.h,
    w: vb.w,
    h: vb.h,
  };
}

/**
 * Tight bounding box of opaque pixels in the raster. Returns `null` for
 * a fully transparent buffer.
 */
export function getRasterBbox(raster: RasterImage): Bbox | null {
  const { data, width, height } = raster;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]!;
      if (alpha <= ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return { minX, minY, maxX: maxX + 1, maxY: maxY + 1 };
}

/**
 * Internal helper: would the new viewBox window clip any visible pixels?
 *
 * Maps the raster bbox into the original viewBox coordinate space, then
 * checks whether it falls outside the shifted window.
 */
function detectClipRiskFromRaster(
  raster: RasterImage,
  original: ViewBoxNumeric,
  shifted: ViewBoxNumeric,
): boolean {
  const bbox = getRasterBbox(raster);
  if (!bbox) return false;

  const sx = original.w / raster.width;
  const sy = original.h / raster.height;
  const minX = original.x + bbox.minX * sx;
  const maxX = original.x + bbox.maxX * sx;
  const minY = original.y + bbox.minY * sy;
  const maxY = original.y + bbox.maxY * sy;

  return (
    minX < shifted.x ||
    maxX > shifted.x + shifted.w ||
    minY < shifted.y ||
    maxY > shifted.y + shifted.h
  );
}

function buildBreadcrumb(
  original: ViewBoxNumeric,
  offset: OpticalOffsetPercent,
  source: 'attribute' | 'derived' | 'default',
  emitMetadata: boolean,
): ViewBoxBreadcrumb {
  if (!emitMetadata) {
    return { 'data-optical-center': '' };
  }

  return {
    'data-optical-center': '',
    'data-optical-original-viewbox':
      source === 'default' ? '(default)' : formatViewBox(original),
    'data-optical-offset': `${formatPercent(offset.dxPercent)} ${formatPercent(offset.dyPercent)}`,
  };
}

function formatPercent(n: number): string {
  return `${n.toFixed(4).replace(/\.?0+$/, '')}%`;
}
