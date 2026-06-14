/**
 * Convenience wrapper that takes an SVG string straight to a viewBox
 * transform — rasterize, compute optical center, and shift the box, all
 * in one call. CLI and the SVG asset transform in the Vite plugin are the
 * primary consumers; downstream tools that already have a raster handy
 * should use `transformViewBox` directly to avoid double rasterization.
 */

import { getOpticalCenter } from '../model/final-model.js';
import { transformViewBox } from '../core/transform-viewbox.js';
import type {
  ViewBoxTransformOptions,
  ViewBoxTransformResult,
} from '../core/transform-viewbox.js';

import { rasterizeSvg } from './rasterize.js';
import type { RasterizeOptions } from './rasterize.js';

export interface TransformViewBoxFromSvgOptions
  extends ViewBoxTransformOptions {
  readonly rasterize?: RasterizeOptions;
}

export function transformViewBoxFromSvg(
  svg: string,
  options?: TransformViewBoxFromSvgOptions,
): ViewBoxTransformResult {
  const raster = rasterizeSvg(svg, options?.rasterize);
  const px = getOpticalCenter(raster);
  const offset = {
    dxPercent: raster.width > 0 ? (px.dx / raster.width) * 100 : 0,
    dyPercent: raster.height > 0 ? (px.dy / raster.height) * 100 : 0,
  };
  return transformViewBox(svg, raster, offset, {
    emitMetadata: options?.emitMetadata === true,
  });
}
