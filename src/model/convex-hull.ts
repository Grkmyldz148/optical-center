/**
 * Convex Hull computation for optical centering.
 *
 * Computes the convex hull of opaque pixels to find the
 * "shape boundary" centroid, which complements the weighted
 * mass centroid from the analyzer.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Cross product of vectors OA and OB where O is the origin point.
 */
function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Compute convex hull using Andrew's monotone chain algorithm.
 * Returns hull vertices in counter-clockwise order.
 *
 * Time complexity: O(n log n) where n = number of points.
 */
export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points];

  // Sort by x, then by y
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

  const n = sorted.length;

  // Build lower hull
  const lower: Point[] = [];
  for (let i = 0; i < n; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
      lower.pop();
    }
    lower.push(sorted[i]);
  }

  // Build upper hull
  const upper: Point[] = [];
  for (let i = n - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
      upper.pop();
    }
    upper.push(sorted[i]);
  }

  // Remove last point of each half because it's repeated
  lower.pop();
  upper.pop();

  return lower.concat(upper);
}

/**
 * Extract boundary points from a weight map (pixels with weight > threshold).
 * Samples every `step` pixels for performance.
 *
 * When step > 1 we always include the last column/row in addition to the
 * step-aligned grid. Without this, a thin feature touching the right or
 * bottom edge can be skipped (e.g. width=120, step=2 → x ∈ {0,2,…,118}, the
 * column at x=119 is never sampled), silently shifting the convex hull
 * centroid inward and biasing the optical-center estimate.
 */
export function extractBoundaryPoints(
  weights: Float32Array,
  width: number,
  height: number,
  threshold: number = 0.01,
  step: number = 1
): Point[] {
  const points: Point[] = [];
  const seen = step > 1 ? new Set<number>() : null;

  const sampleRow = (y: number) => {
    for (let x = 0; x < width; x += step) {
      const idx = y * width + x;
      if (weights[idx] > threshold) {
        if (seen) {
          if (seen.has(idx)) continue;
          seen.add(idx);
        }
        points.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
    // Always include the last column when step > 1
    if (step > 1) {
      const xLast = width - 1;
      const idx = y * width + xLast;
      if (weights[idx] > threshold) {
        if (seen) {
          if (seen.has(idx)) return;
          seen.add(idx);
        }
        points.push({ x: xLast + 0.5, y: y + 0.5 });
      }
    }
  };

  for (let y = 0; y < height; y += step) sampleRow(y);
  // Always include the last row when step > 1
  if (step > 1 && (height - 1) % step !== 0) sampleRow(height - 1);

  return points;
}

/**
 * Compute the centroid (geometric center) of a convex hull polygon.
 * Uses the signed area formula for polygon centroid.
 *
 * @param hull Convex hull vertices (counter-clockwise).
 * @param fallback Returned when the hull is empty. Use the image's geometric
 *   center to avoid biasing the optical-center estimate toward the (0,0)
 *   corner when an icon has no detectable boundary pixels.
 */
export function hullCentroid(hull: Point[], fallback: Point = { x: 0, y: 0 }): Point {
  if (hull.length === 0) return { ...fallback };
  if (hull.length === 1) return { ...hull[0] };
  if (hull.length === 2) {
    return {
      x: (hull[0].x + hull[1].x) / 2,
      y: (hull[0].y + hull[1].y) / 2,
    };
  }

  let signedArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    const a = hull[i];
    const b = hull[j];
    const f = a.x * b.y - b.x * a.y;
    signedArea += f;
    cx += (a.x + b.x) * f;
    cy += (a.y + b.y) * f;
  }

  signedArea /= 2;

  if (Math.abs(signedArea) < 1e-10) {
    // Degenerate polygon — fall back to simple average
    const avgX = hull.reduce((s, p) => s + p.x, 0) / hull.length;
    const avgY = hull.reduce((s, p) => s + p.y, 0) / hull.length;
    return { x: avgX, y: avgY };
  }

  cx /= 6 * signedArea;
  cy /= 6 * signedArea;

  return { x: cx, y: cy };
}
