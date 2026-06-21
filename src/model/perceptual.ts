/**
 * Perceptual Corrections for Optical Centering
 *
 * Humans don't perceive the geometric center as the visual center.
 * This module applies corrections based on known perceptual biases.
 */

export interface PerceptualConfig {
  /**
   * Vertical bias factor. Currently 0 by default — across all three studies
   * humans placed icons at ~0 vertical offset. Range: 0 (no correction) to 0.1.
   * Default: 0.
   *
   * NOTE: V1 (`computeOffset`) applies this; V2 (`computeOffsetV2`) does NOT.
   * Set to non-zero only when intentionally testing a global up/down shift in V1.
   */
  verticalBias: number;

  /**
   * Weight given to convex hull centroid vs mass centroid (V1 blend).
   * 0 = pure mass centroid, 1 = pure hull centroid.
   * Default: 0.3 (70% mass, 30% hull).
   *
   * NOTE: This is the V1 blend parameter. V2 has its own weights
   * (`ComputeOptionsV2.{edgeWeight, hullWeight, symmetryWeight}`); the V2
   * `hullWeight` is independent and they happen to share a name.
   */
  hullWeight: number;

  /**
   * V1-only knob. When true, V1 applies `applyShapeCorrection` after the
   * mass/hull blend (`compute-offset.ts:156-164`). V2 IGNORES this flag.
   * Default: true (V1 behavior unchanged from initial release).
   */
  shapeCorrection: boolean;
}

export const DEFAULT_PERCEPTUAL_CONFIG: PerceptualConfig = {
  // No global vertical bias: across all three studies humans placed icons at
  // ~0 vertical offset (Phase 1 adjustment median 0.00; Phase 3 adjustment
  // median 0.10 with residuals undoing the model's downward shift; Phase 2
  // 2AFC rejected the model's vertical correction on vertical-dominant icons,
  // ~29% vs ~46% horizontal). Vertical offset is per-icon (mass/hull/symmetry),
  // not a global constant. Previously 0.035.
  verticalBias: 0,
  hullWeight: 0.3,
  shapeCorrection: true, // V1-only; V2 ignores this
};

/**
 * Blend two centroids using a weight factor.
 * factor=0 → returns centroid A, factor=1 → returns centroid B.
 */
export function blendCentroids(
  a: { x: number; y: number },
  b: { x: number; y: number },
  factor: number
): { x: number; y: number } {
  return {
    x: a.x * (1 - factor) + b.x * factor,
    y: a.y * (1 - factor) + b.y * factor,
  };
}

/**
 * Apply vertical bias correction.
 *
 * The emitted render offset is computed downstream as
 * (geometricCenter − opticalCenter). To shift the rendered icon UPWARD by
 * `bias × height` — the perceptual upward bias documented in the literature
 * (perceived center sits above the geometric center) — the optical-center
 * estimate must be moved DOWN here so the inversion yields a negative (upward)
 * dy. The previous `cy - height * bias` moved the estimate up, which inverted
 * to a DOWNWARD render offset, the opposite of the intended bias.
 */
export function applyVerticalBias(
  cy: number,
  height: number,
  bias: number
): number {
  return cy + height * bias;
}

/**
 * Analyze the shape distribution to detect asymmetry.
 * Returns asymmetry factors for x and y axes.
 *
 * Values > 0 indicate mass concentrated toward positive direction.
 * Values < 0 indicate mass concentrated toward negative direction.
 */
export function analyzeAsymmetry(
  weights: Float32Array,
  width: number,
  height: number
): { asymX: number; asymY: number } {
  // Use pixel-center coordinates (x + 0.5) so a pixel at column x is treated
  // as occupying [x, x+1). Compare against the geometric midline width/2.
  // For odd width, the central pixel straddles the midline and is split
  // half-and-half between left and right; this preserves asymX = 0 on any
  // bilaterally symmetric input regardless of width parity.
  const midX = width / 2;
  const midY = height / 2;

  let leftWeight = 0;
  let rightWeight = 0;
  let topWeight = 0;
  let bottomWeight = 0;

  for (let y = 0; y < height; y++) {
    const pyMin = y;
    const pyMax = y + 1;
    // Horizontal slice (column-by-column) using pixel-center semantics:
    // the column at integer x covers [x, x+1). If midX falls strictly inside
    // a column (odd width), that column contributes its weight half-half.
    let topSliceContribY = 0; // 0 = full top, 1 = full bottom, fractional = split
    if (pyMax <= midY) topSliceContribY = 0; // entire row above midline
    else if (pyMin >= midY) topSliceContribY = 1; // entire row below midline
    else topSliceContribY = midY - pyMin; // fractional split

    for (let x = 0; x < width; x++) {
      const w = weights[y * width + x];
      if (w <= 0) continue;

      const pxMin = x;
      const pxMax = x + 1;
      let rightFrac: number;
      if (pxMax <= midX) rightFrac = 0;
      else if (pxMin >= midX) rightFrac = 1;
      else rightFrac = pxMax - midX; // straddling column

      leftWeight += w * (1 - rightFrac);
      rightWeight += w * rightFrac;
      topWeight += w * (1 - topSliceContribY);
      bottomWeight += w * topSliceContribY;
    }
  }

  const totalH = leftWeight + rightWeight;
  const totalV = topWeight + bottomWeight;

  return {
    asymX: totalH > 0 ? (rightWeight - leftWeight) / totalH : 0,
    asymY: totalV > 0 ? (bottomWeight - topWeight) / totalV : 0,
  };
}

/**
 * Apply shape-aware correction based on asymmetry analysis.
 * Pushes the optical center slightly toward the heavier side,
 * counteracting the visual "pull" of asymmetric shapes.
 */
export function applyShapeCorrection(
  cx: number,
  cy: number,
  width: number,
  height: number,
  asymmetry: { asymX: number; asymY: number },
  strength: number = 0.15
): { x: number; y: number } {
  return {
    x: cx + asymmetry.asymX * width * strength,
    y: cy + asymmetry.asymY * height * strength,
  };
}
