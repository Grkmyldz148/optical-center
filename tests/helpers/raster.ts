/**
 * Raster fixtures for tests that exercise pixel-level math without
 * involving the full SVG → PNG → bitmap pipeline. Fast and deterministic.
 */

import type { RasterImage } from '../../src/core/types.js';

export function emptyRaster(width = 24, height = 24): RasterImage {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  };
}

export function rasterWithBlock(
  rect: { x: number; y: number; w: number; h: number },
  width = 24,
  height = 24,
): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = (y * width + x) * 4;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}
