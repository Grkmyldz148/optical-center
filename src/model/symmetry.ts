/**
 * Symmetry Detection
 *
 * Measures bilateral (reflective) and radial (rotational) symmetry of a
 * visual weight map. Symmetric shapes need less optical correction because
 * the geometric and perceptual centres naturally coincide; asymmetric
 * shapes need a stronger pull toward the "heavy" side.
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Full symmetry analysis result for a weight map. */
export interface SymmetryResult {
  /** Left-right (vertical axis) bilateral symmetry score in [0, 1]. */
  bilateralX: number;
  /** Top-bottom (horizontal axis) bilateral symmetry score in [0, 1]. */
  bilateralY: number;
  /** Rotational symmetry score in [0, 1]. */
  radial: number;
  /** Angle (radians) of the strongest bilateral symmetry axis. */
  dominantAxis: number;
}

/** Correction vector derived from symmetry analysis. */
export interface SymmetryCorrection {
  /** Horizontal correction in pixels. */
  dx: number;
  /** Vertical correction in pixels. */
  dy: number;
}

/** Result of the symmetry-axis scan. */
export interface SymmetryAxisResult {
  /** Angle (radians, in [0, pi)) of the best symmetry axis. */
  angle: number;
  /** Bilateral symmetry score along that axis. */
  score: number;
}

// ---------------------------------------------------------------------------
// Bilateral Symmetry
// ---------------------------------------------------------------------------

/**
 * Compute bilateral symmetry of a weight map along the given axis.
 *
 * @param weights - Row-major visual weight values (length = width * height).
 * @param width   - Width of the weight map.
 * @param height  - Height of the weight map.
 * @param axis    - 'x' for left-right (vertical axis) symmetry,
 *                  'y' for top-bottom (horizontal axis) symmetry.
 * @returns A symmetry score in [0, 1] where 1 = perfectly symmetric.
 */
export function computeBilateralSymmetry(
  weights: Float32Array,
  width: number,
  height: number,
  axis: 'x' | 'y'
): number {
  let diffSum = 0;
  let totalWeight = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const w = weights[idx]!;
      totalWeight += w;

      let flippedIdx: number;
      if (axis === 'x') {
        // Mirror horizontally: (x, y) -> (width - 1 - x, y)
        flippedIdx = y * width + (width - 1 - x);
      } else {
        // Mirror vertically: (x, y) -> (x, height - 1 - y)
        flippedIdx = (height - 1 - y) * width + x;
      }
      const wFlipped = weights[flippedIdx]!;
      diffSum += Math.abs(w - wFlipped);
    }
  }

  if (totalWeight === 0) return 1; // empty image is trivially symmetric

  // diffSum double-counts each pair, so divide by 2
  const score = 1 - diffSum / (2 * totalWeight);
  return Math.max(0, Math.min(1, score));
}

// ---------------------------------------------------------------------------
// Radial Symmetry
// ---------------------------------------------------------------------------

/**
 * Compute radial (rotational) symmetry of a weight map around a given center.
 *
 * @param weights - Row-major visual weight values.
 * @param width   - Width of the weight map.
 * @param height  - Height of the weight map.
 * @param cx      - x coordinate of the rotation center.
 * @param cy      - y coordinate of the rotation center.
 * @param folds   - Number of rotational folds to test (e.g. 4 for 90deg symmetry).
 * @returns A symmetry score in [0, 1] where 1 = perfect rotational symmetry.
 */
export function computeRadialSymmetry(
  weights: Float32Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  folds: number = 4
): number {
  if (folds < 2) return 1;

  let totalDiff = 0;
  let totalWeight = 0;
  let comparisons = 0;

  for (let k = 1; k < folds; k++) {
    const theta = (2 * Math.PI * k) / folds;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const w = weights[y * width + x]!;

        // Rotate (x, y) around (cx, cy) by theta
        const dx = x - cx;
        const dy = y - cy;
        const rx = dx * cosT - dy * sinT + cx;
        const ry = dx * sinT + dy * cosT + cy;

        // Bilinear interpolation of rotated position
        const x0 = Math.floor(rx);
        const y0 = Math.floor(ry);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        if (x0 < 0 || x1 >= width || y0 < 0 || y1 >= height) {
          continue; // Skip out-of-bounds samples
        }

        const fx = rx - x0;
        const fy = ry - y0;
        const wRotated =
          weights[y0 * width + x0]! * (1 - fx) * (1 - fy) +
          weights[y0 * width + x1]! * fx * (1 - fy) +
          weights[y1 * width + x0]! * (1 - fx) * fy +
          weights[y1 * width + x1]! * fx * fy;

        totalDiff += Math.abs(w - wRotated);
        totalWeight += w + wRotated;
        comparisons++;
      }
    }
  }

  if (totalWeight === 0 || comparisons === 0) return 1;

  const score = 1 - totalDiff / totalWeight;
  return Math.max(0, Math.min(1, score));
}

// ---------------------------------------------------------------------------
// Symmetry Axis Scan
// ---------------------------------------------------------------------------

/**
 * Scan a range of angles to find the bilateral symmetry axis with the
 * highest score.
 *
 * The default of 12 angles (15° resolution) was tuned in Phase 2.5: the
 * dxPercent delta vs 36 angles is below 0.05% on the validation icon set
 * — invisible to a human — while the inner loop runs 3× fewer times.
 *
 * @param weights   - Row-major visual weight values.
 * @param width     - Width of the weight map.
 * @param height    - Height of the weight map.
 * @param numAngles - Number of angles to sample in [0, pi). Default: 12.
 * @returns The {@link SymmetryAxisResult} with the best angle and its score.
 */
export function computeSymmetryAxis(
  weights: Float32Array,
  width: number,
  height: number,
  numAngles: number = 12
): SymmetryAxisResult {
  const cx = width / 2;
  const cy = height / 2;

  let bestAngle = 0;
  let bestScore = 0;

  for (let i = 0; i < numAngles; i++) {
    const theta = (Math.PI * i) / numAngles; // [0, pi)

    // For this axis angle, reflect every pixel and compare
    // Reflection across axis at angle theta through center (cx, cy):
    //   dx' = dx * cos(2*theta) + dy * sin(2*theta)
    //   dy' = dx * sin(2*theta) - dy * cos(2*theta)
    const cos2t = Math.cos(2 * theta);
    const sin2t = Math.sin(2 * theta);

    let diffSum = 0;
    let totalWeight = 0;
    let validPixels = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const w = weights[y * width + x]!;
        totalWeight += w;

        // Translate to center
        const dx = x - cx;
        const dy = y - cy;

        // Reflect across axis
        const rx = dx * cos2t + dy * sin2t + cx;
        const ry = dx * sin2t - dy * cos2t + cy;

        // Bilinear interpolation of reflected position
        const x0 = Math.floor(rx);
        const y0 = Math.floor(ry);

        if (x0 < 0 || x0 + 1 >= width || y0 < 0 || y0 + 1 >= height) {
          continue;
        }

        const fx = rx - x0;
        const fy = ry - y0;
        const wReflected =
          weights[y0 * width + x0]! * (1 - fx) * (1 - fy) +
          weights[y0 * width + (x0 + 1)]! * fx * (1 - fy) +
          weights[(y0 + 1) * width + x0]! * (1 - fx) * fy +
          weights[(y0 + 1) * width + (x0 + 1)]! * fx * fy;

        diffSum += Math.abs(w - wReflected);
        validPixels++;
      }
    }

    if (totalWeight === 0 || validPixels === 0) continue;

    const score = 1 - diffSum / (2 * totalWeight);
    const clampedScore = Math.max(0, Math.min(1, score));

    if (clampedScore > bestScore) {
      bestScore = clampedScore;
      bestAngle = theta;
    }
  }

  return { angle: bestAngle, score: bestScore };
}

// ---------------------------------------------------------------------------
// Symmetry Correction
// ---------------------------------------------------------------------------

/**
 * Compute an offset correction based on the symmetry analysis.
 *
 * Highly symmetric shapes need little correction (the geometric center is
 * already a good optical center). Asymmetric shapes need a stronger pull
 * toward the visually heavy side.
 *
 * @param symmetry - A {@link SymmetryResult} from a full analysis.
 * @param width    - Width of the image.
 * @param height   - Height of the image.
 * @returns A {@link SymmetryCorrection} vector (dx, dy) to add to the optical center.
 */
export function computeSymmetryCorrection(
  symmetry: SymmetryResult,
  width: number,
  height: number
): SymmetryCorrection {
  // The less symmetric an axis is, the more correction is needed along it.
  // Radial symmetry dampens the correction: a pinwheel can have low
  // bilateral symmetry but still be balanced around the center.
  const scaleFactor = 0.03;
  const radialDamping = symmetry.radial; // high radial -> less correction

  const asymFactorX = 1 - symmetry.bilateralX;
  const asymFactorY = 1 - symmetry.bilateralY;

  const dx = asymFactorX * (1 - radialDamping) * width * scaleFactor;
  const dy = asymFactorY * (1 - radialDamping) * height * scaleFactor;

  return { dx, dy };
}

// ---------------------------------------------------------------------------
// Full Symmetry Analysis
// ---------------------------------------------------------------------------

/**
 * Run the full symmetry analysis pipeline on a weight map.
 *
 * @param weights - Row-major visual weight values.
 * @param width   - Width of the weight map.
 * @param height  - Height of the weight map.
 * @returns A complete {@link SymmetryResult}.
 */
export function analyzeSymmetry(
  weights: Float32Array,
  width: number,
  height: number
): SymmetryResult {
  const bilateralX = computeBilateralSymmetry(weights, width, height, 'x');
  const bilateralY = computeBilateralSymmetry(weights, width, height, 'y');
  const radial = computeRadialSymmetry(
    weights,
    width,
    height,
    width / 2,
    height / 2,
    4
  );
  const axis = computeSymmetryAxis(weights, width, height);

  return {
    bilateralX,
    bilateralY,
    radial,
    dominantAxis: axis.angle,
  };
}
