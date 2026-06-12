/**
 * `correctIcon` / `correctIcons` — the single funnel every surface calls
 * to turn icon geometry into an optical shift, reusing the exact same
 * model the rest of optical-center uses (`transformViewBoxFromSvg`:
 * rasterize → optical centre → offset). Results are memoised on disk
 * through the shared `TransformCache`, keyed by the assembled measurement
 * SVG, so an icon body is rasterized once across the whole toolchain.
 *
 * `correctIcons` is the batch form: cache misses are fanned out across
 * the worker-thread `MeasurePool` (when available), so correcting a
 * whole Iconify family scales with core count instead of serialising
 * ~7ms of model per icon on one thread.
 *
 * Two-phase by construction: this module only ever *reads* (rasterizes
 * and measures). The geometry write-back lives in the caller (e.g. the
 * Iconify rewrite), so a native rasterizer failure can never leave a
 * half-mutated icon — a failed measurement simply yields a zero shift.
 */

import { MAX_INPUT_BYTES } from '../core/constants.js';
import { TransformCache } from '../cache/transform-cache.js';

import { assembleIconSvg } from './assemble-svg.js';
import type { IconGeom } from './assemble-svg.js';
import { measureShift, NO_SHIFT } from './measure.js';
import type { IconSize, OpticalShift } from './measure.js';
import { measurePool } from './measure-pool.js';

export type { OpticalShift } from './measure.js';

const EPSILON = 1e-4;

/**
 * Below this many cache misses a batch is measured in-thread — spawning
 * (or even waking) the worker pool costs more than the measurements.
 */
const POOL_THRESHOLD = 16;

/**
 * Upper bound on in-flight measure+cache-write pairs during a batch.
 * Bounds concurrent cache-file writes (thousands at once would exhaust
 * fds) while staying far above the pool size, so workers never starve.
 */
const BATCH_CONCURRENCY = 64;

let sharedCache: TransformCache<OpticalShift> | null = null;
function cache(): TransformCache<OpticalShift> {
  if (sharedCache === null) sharedCache = new TransformCache<OpticalShift>();
  return sharedCache;
}

/**
 * Measure the optical shift for an icon geometry. Cached on disk; pure
 * read (no mutation). Returns a zero shift on any failure — a broken body
 * or a native crash must never break the build.
 *
 * Why a body *translate* rather than a viewBox shift? `transformViewBoxFromSvg`
 * returns the corrected window origin `x' = x - (dxPercent/100)·w`. Rendering
 * the original viewBox with the body translated by `t = x - x' = (dxPercent/100)·w`
 * is pixel-identical to rendering the shifted viewBox — and, unlike editing
 * `left`/`top`, the translate composes correctly under a renderer's
 * `hFlip`/`vFlip`/`rotate`. So `dx = (dxPercent/100)·width`, same sign as the
 * percentage.
 */
export async function correctIcon(geom: IconGeom): Promise<OpticalShift> {
  const svg = assembleIconSvg(geom);
  if (Buffer.byteLength(svg, 'utf8') > MAX_INPUT_BYTES) return NO_SHIFT;

  const hit = await cache().get(svg);
  if (hit.value !== null) return hit.value;

  const shift = measureShift(svg, geom);
  await cache().set(svg, shift);
  return shift;
}

/**
 * Batch form of `correctIcon`, position-aligned with its input. Cache
 * hits are resolved inline; misses are measured on the worker pool when
 * the batch is big enough to pay for it, in-thread otherwise. Either way
 * every result lands in the same shared cache with the same key, so
 * single and batch callers always agree.
 */
export async function correctIcons(
  geoms: readonly IconGeom[],
): Promise<OpticalShift[]> {
  const out: OpticalShift[] = new Array<OpticalShift>(geoms.length).fill(
    NO_SHIFT,
  );
  const misses: Array<{ index: number; svg: string; size: IconSize }> = [];

  for (let i = 0; i < geoms.length; i++) {
    const geom = geoms[i]!;
    const svg = assembleIconSvg(geom);
    if (Buffer.byteLength(svg, 'utf8') > MAX_INPUT_BYTES) continue;
    const hit = await cache().get(svg);
    if (hit.value !== null) {
      out[i] = hit.value;
      continue;
    }
    misses.push({
      index: i,
      svg,
      size: { width: geom.width, height: geom.height },
    });
  }

  if (misses.length === 0) return out;

  const pool = misses.length >= POOL_THRESHOLD ? measurePool() : null;
  await mapBounded(misses, BATCH_CONCURRENCY, async (miss) => {
    const shift = pool
      ? await pool.measure(miss.svg, miss.size)
      : measureShift(miss.svg, miss.size);
    out[miss.index] = shift;
    await cache().set(miss.svg, shift);
  });

  return out;
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function mapBounded<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lanes = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const item = items[next++]!;
        await fn(item);
      }
    },
  );
  await Promise.all(lanes);
}

/** Deterministic coordinate formatting — stable cache keys, no HMR drift. */
export function formatCoord(n: number): string {
  const v = Object.is(n, -0) ? 0 : n;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(4).replace(/\.?0+$/, '');
}

/**
 * Bake an optical shift into an icon body by wrapping it in an inner
 * `<g transform="translate(dx dy)">`. Returns the body unchanged when the
 * shift is negligible, so a zero-shift icon is left byte-identical.
 */
export function wrapBody(body: string, shift: OpticalShift): string {
  if (Math.abs(shift.dx) < EPSILON && Math.abs(shift.dy) < EPSILON) return body;
  return `<g transform="translate(${formatCoord(shift.dx)} ${formatCoord(shift.dy)})">${body}</g>`;
}
