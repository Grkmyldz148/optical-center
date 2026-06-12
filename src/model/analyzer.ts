/**
 * Visual Weight Analyzer
 *
 * Rasterizes an element using Canvas 2D and computes per-pixel
 * visual weight as alpha × luminance. This produces a weight map
 * that represents how "visually heavy" each pixel appears.
 */

export interface PixelData {
  width: number;
  height: number;
  /** Flat array of visual weights, row-major, length = width × height */
  weights: Float32Array;
}

export interface AnalyzerOptions {
  /** Resolution to rasterize at. Default: native size */
  scale?: number;
  /** Maximum dimension (width or height) for performance. Default: 256 */
  maxSize?: number;
}

/**
 * Convert RGB to relative luminance (ITU-R BT.709).
 * L = 0.2126·R + 0.7152·G + 0.0722·B (values in 0-1 range)
 */
export function rgbToLuminance(r: number, g: number, b: number): number {
  return 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
}

/**
 * Build a visual weight map from raw RGBA pixel data.
 * Weight = alpha × luminance (both normalized to 0-1).
 *
 * For dark-on-transparent content (typical icons), we invert luminance
 * so that darker pixels have higher weight.
 */
export function buildWeightMap(
  imageData: { data: Uint8ClampedArray; width: number; height: number }
): PixelData {
  const { data, width, height } = imageData;
  const weights = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3] / 255; // normalize alpha

    if (a < 0.01) {
      weights[i] = 0;
      continue;
    }

    // Invert luminance: dark pixels = high weight (common for icons)
    const luminance = rgbToLuminance(r, g, b);
    const invertedLuminance = 1 - luminance;

    weights[i] = a * invertedLuminance;
  }

  return { width, height, weights };
}

/**
 * Build a weight map from raw RGBA buffer (e.g., from Canvas getImageData).
 */
export function buildWeightMapFromBuffer(
  buffer: Uint8ClampedArray,
  width: number,
  height: number
): PixelData {
  return buildWeightMap({ data: buffer, width, height });
}

/**
 * Compute the weighted centroid from a weight map.
 * Returns coordinates in pixel space relative to top-left corner.
 *
 * Cx = Σ(x·w) / Σw
 * Cy = Σ(y·w) / Σw
 */
export function computeWeightedCentroid(
  pixelData: PixelData
): { cx: number; cy: number; totalWeight: number } {
  const { width, height, weights } = pixelData;
  let sumW = 0;
  let sumXW = 0;
  let sumYW = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = weights[y * width + x];
      if (w > 0) {
        sumW += w;
        sumXW += (x + 0.5) * w; // use pixel center
        sumYW += (y + 0.5) * w;
      }
    }
  }

  if (sumW === 0) {
    return { cx: width / 2, cy: height / 2, totalWeight: 0 };
  }

  return {
    cx: sumXW / sumW,
    cy: sumYW / sumW,
    totalWeight: sumW,
  };
}
