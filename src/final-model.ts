/**
 * Final optical center model.
 *
 * Given an icon's raster pixel buffer, returns the offset that should be
 * applied to render the icon perceptually centered (rather than geometrically
 * centered) inside its container.
 *
 * Derivation:
 *   - Raw pipeline: biologically-inspired V2 (DoG + compression + blended
 *     centroids + symmetry correction + vertical bias)
 *   - Scale factor: × 0.745, from Phase 2 (2AFC) pooled PSE on 20 icons with
 *     30 participants. Humans prefer 74.5% of the V2 raw correction.
 *
 * Output units: same as input imageData (raster pixels). Scale to display px
 * by multiplying by (displaySize / rasterSize).
 */

import { computeOffsetV2 } from './compute-offset.js';

/**
 * Phase 2 pooled PSE — the proportion of V2 raw correction that humans prefer.
 * Measured via 2AFC (bias-free forced choice). 30 participants × 120 trials.
 */
export const CORRECTION_SCALE = 0.745;

export interface OpticalCenterResult {
  /** Horizontal offset in raster pixels. Positive = shift right. */
  dx: number;
  /** Vertical offset in raster pixels. Positive = shift down. */
  dy: number;
  /** Horizontal offset as percentage of element width. */
  dxPercent: number;
  /** Vertical offset as percentage of element height. */
  dyPercent: number;
}

/**
 * Compute the optical center offset for an icon.
 *
 * @param imageData Rasterized icon (Uint8ClampedArray RGBA).
 * @returns Offset in raster px to apply for perceptual centering.
 */
export function getOpticalCenter(imageData: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}): OpticalCenterResult {
  const raw = computeOffsetV2(imageData);
  return {
    dx: raw.dx * CORRECTION_SCALE,
    dy: raw.dy * CORRECTION_SCALE,
    dxPercent: raw.dxPercent * CORRECTION_SCALE,
    dyPercent: raw.dyPercent * CORRECTION_SCALE,
  };
}
