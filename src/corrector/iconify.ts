/**
 * Geometry rewrite for the Iconify data model — whole collections and
 * standalone single-icon objects. Mutates the parsed value in place,
 * body-wrapping each icon and stamping a sentinel so an already-corrected
 * value is recognised and skipped.
 *
 * Aliases are intentionally NOT visited. A pure re-point alias has no body
 * of its own — Iconify resolves it to its parent at render time, so it
 * inherits the parent's corrected (wrapped) body for free. An alias that
 * adds its own `hFlip`/`vFlip`/`rotate` still renders correctly because the
 * body-wrap translate composes inside the renderer's transform wrapper —
 * which is the whole reason the shift is a body translate and not a
 * `left`/`top` edit.
 */

import { algorithmCacheKey } from '../cache/algorithm-fingerprint.js';

import { readGeomDefaults, resolveGeom } from './assemble-svg.js';
import type { IconGeom } from './assemble-svg.js';
import { correctIcon, correctIcons, wrapBody } from './index.js';

/** Root key stamped on a corrected value. Unknown to Iconify's validator. */
export const SENTINEL_KEY = '_opticalCenter';

export interface CollectionStats {
  /** Icons whose body was actually shifted (non-zero offset). */
  readonly corrected: number;
  /** Icon records considered (had a usable body). */
  readonly total: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Body-wrap every icon in an Iconify collection in place. No-op (and
 * `corrected: 0`) if the set is already stamped for this algorithm version.
 */
export async function correctCollection(
  set: Record<string, unknown>,
): Promise<CollectionStats> {
  const sentinel = algorithmCacheKey();
  if (set[SENTINEL_KEY] === sentinel) return { corrected: 0, total: 0 };

  const icons = set['icons'];
  if (!isPlainObject(icons)) return { corrected: 0, total: 0 };

  const defaults = readGeomDefaults(set);

  // Two passes: gather every measurable record first, then measure as one
  // batch so `correctIcons` can fan cache misses out across the worker
  // pool instead of serialising the model icon by icon.
  const entries: Array<{
    record: Record<string, unknown>;
    geom: IconGeom;
  }> = [];
  for (const name of Object.keys(icons)) {
    const record = icons[name];
    if (!isPlainObject(record)) continue;
    const geom = resolveGeom(record, defaults);
    if (geom === null) continue;
    entries.push({ record, geom });
  }

  const shifts = await correctIcons(entries.map((e) => e.geom));
  let corrected = 0;
  entries.forEach(({ record, geom }, i) => {
    const wrapped = wrapBody(geom.body, shifts[i]!);
    if (wrapped !== geom.body) {
      record['body'] = wrapped;
      corrected++;
    }
  });

  set[SENTINEL_KEY] = sentinel;
  return { corrected, total: entries.length };
}

/**
 * Body-wrap a standalone single-icon object in place. Returns `true` when
 * the body was shifted. Stamps the sentinel either way so a re-run is a
 * no-op.
 */
export async function correctSingleIcon(
  icon: Record<string, unknown>,
): Promise<boolean> {
  const sentinel = algorithmCacheKey();
  if (icon[SENTINEL_KEY] === sentinel) return false;

  const geom = resolveGeom(icon);
  if (geom === null) {
    icon[SENTINEL_KEY] = sentinel;
    return false;
  }

  const shift = await correctIcon(geom);
  const wrapped = wrapBody(geom.body, shift);
  const changed = wrapped !== geom.body;
  if (changed) icon['body'] = wrapped;
  icon[SENTINEL_KEY] = sentinel;
  return changed;
}
