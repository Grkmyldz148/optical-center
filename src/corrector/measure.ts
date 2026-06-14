/**
 * The one pure measurement step of icon correction: assembled SVG in,
 * optical shift out. Extracted from `correctIcon` so the worker-thread
 * entry (`measure-worker.ts`) and the in-thread fallback share the exact
 * same code path — a worker must never disagree with the main thread
 * about an offset, or cache entries would depend on where they were
 * computed.
 */

import { transformViewBoxFromSvg } from '../node/transform-viewbox-from-svg.js';

/** The optical shift for one icon, expressed in its own viewBox units. */
export interface OpticalShift {
  /** Horizontal body translate. Equals `(dxPercent / 100) * width`. */
  readonly dx: number;
  /** Vertical body translate. Equals `(dyPercent / 100) * height`. */
  readonly dy: number;
  /** `true` when the shift would push the glyph outside its box. */
  readonly clipDetected: boolean;
}

export const NO_SHIFT: OpticalShift = { dx: 0, dy: 0, clipDetected: false };

export interface IconSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Measure the optical shift for an assembled measurement SVG. Returns a
 * zero shift on any failure — a broken body or a native crash must never
 * break the build.
 */
export function measureShift(svg: string, size: IconSize): OpticalShift {
  try {
    const result = transformViewBoxFromSvg(svg);
    if (result.clipDetected) {
      // A shift that clips the glyph is worse than no shift. Skip it, but
      // record the clip so callers can surface it.
      return { dx: 0, dy: 0, clipDetected: true };
    }
    return {
      dx: (result.offset.dxPercent / 100) * size.width,
      dy: (result.offset.dyPercent / 100) * size.height,
      clipDetected: false,
    };
  } catch {
    return NO_SHIFT;
  }
}
