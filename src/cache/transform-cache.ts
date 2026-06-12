/**
 * Build-time cache for transformViewBox results. Keeps icons that don't
 * change between runs from re-rasterizing and re-running the pipeline,
 * which is the entire reason this is a build-time tool.
 *
 * Layout (per ADR-7):
 *   <root>/<algorithmVersion>/<hash>.json
 *
 * Hash key inputs:
 *   - raw SVG bytes (no normalization — F3 collision guard)
 *   - algorithm version (so a pipeline change invalidates everything)
 *
 * The reader validates `entry.input.hash === lookupHash` after JSON parse
 * to catch poisoned files. An L1 in-memory LRU sits in front of disk so
 * the same icon repeated across components doesn't pay the filesystem
 * round-trip 50 times.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import writeFileAtomic from 'write-file-atomic';

import { ALGORITHM_VERSION } from '../core/version.js';

import { algorithmCacheKey } from './algorithm-fingerprint.js';

export interface CacheEntry<T> {
  readonly v: 1;
  readonly key: string;
  readonly algorithmVersion: string;
  readonly computedAt: string;
  readonly value: T;
}

export interface CacheOptions {
  readonly dir?: string;
  readonly l1Capacity?: number;
}

export interface CacheStats {
  l1Hits: number;
  l2Hits: number;
  misses: number;
  writes: number;
  writeFailures: number;
}

const DEFAULT_L1_CAPACITY = 1000;

/**
 * Compute the deterministic cache key for an SVG payload.
 *
 * Hashing raw bytes — not normalized content — closes the F3 collision
 * vector flagged by security-sentinel: an attacker who controls SVG input
 * can't engineer two distinct payloads that share the same key.
 *
 * The algorithm cache key blends the hand-maintained ALGORITHM_VERSION
 * with a SHA fingerprint of the model source — so that even an unbumped
 * tweak to the math invalidates stale entries.
 */
export function computeCacheKey(svg: string): string {
  return createHash('sha256')
    .update(svg)
    .update(algorithmCacheKey())
    .digest('hex');
}

export class TransformCache<T> {
  private readonly dir: string;
  private readonly l1: Map<string, T> = new Map();
  private readonly l1Capacity: number;
  readonly stats: CacheStats = {
    l1Hits: 0,
    l2Hits: 0,
    misses: 0,
    writes: 0,
    writeFailures: 0,
  };

  constructor(options?: CacheOptions) {
    this.dir = join(
      options?.dir ?? defaultCacheDir(),
      ALGORITHM_VERSION,
    );
    this.l1Capacity = options?.l1Capacity ?? DEFAULT_L1_CAPACITY;
  }

  /** Look up a value by SVG content. Returns `null` on miss. */
  async get(svg: string): Promise<{ key: string; value: T | null }> {
    const key = computeCacheKey(svg);

    const memoized = this.l1.get(key);
    if (memoized !== undefined) {
      // Move to most-recent position
      this.l1.delete(key);
      this.l1.set(key, memoized);
      this.stats.l1Hits++;
      return { key, value: memoized };
    }

    try {
      const raw = await readFile(this.entryPath(key), 'utf8');
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (entry.key !== key || entry.algorithmVersion !== ALGORITHM_VERSION) {
        this.stats.misses++;
        return { key, value: null };
      }
      this.promoteL1(key, entry.value);
      this.stats.l2Hits++;
      return { key, value: entry.value };
    } catch {
      this.stats.misses++;
      return { key, value: null };
    }
  }

  /** Store a value under the SVG content's key. */
  async set(svg: string, value: T): Promise<{ key: string; written: boolean }> {
    const key = computeCacheKey(svg);
    this.promoteL1(key, value);

    const entry: CacheEntry<T> = {
      v: 1,
      key,
      algorithmVersion: ALGORITHM_VERSION,
      computedAt: new Date().toISOString(),
      value,
    };

    try {
      await writeAtomic(this.entryPath(key), JSON.stringify(entry));
      this.stats.writes++;
      return { key, written: true };
    } catch {
      this.stats.writeFailures++;
      return { key, written: false };
    }
  }

  /** Drop the in-memory layer. Disk entries are untouched. */
  clearL1(): void {
    this.l1.clear();
  }

  private entryPath(key: string): string {
    return join(this.dir, `${key}.json`);
  }

  private promoteL1(key: string, value: T): void {
    if (this.l1.has(key)) this.l1.delete(key);
    this.l1.set(key, value);
    while (this.l1.size > this.l1Capacity) {
      const oldest = this.l1.keys().next().value;
      if (oldest === undefined) break;
      this.l1.delete(oldest);
    }
  }
}

/**
 * Default cache root: nearest `node_modules/.cache/optical-center` walking
 * upward from cwd. Falls back to `<cwd>/.optical-center-cache` if no
 * `node_modules` is found (e.g. when invoked from outside a Node project).
 */
export function defaultCacheDir(): string {
  // Resolved lazily via env so tests can override without monkey-patching.
  const override = process.env['OPTICAL_CACHE_DIR'];
  if (override) return override;
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'node_modules'))) {
      return join(dir, 'node_modules', '.cache', 'optical-center');
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), '.optical-center-cache');
}

async function writeAtomic(target: string, content: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  // write-file-atomic handles the tmp-file rename dance and the Windows
  // file-lock retry loop that the previous hand-rolled version would
  // silently fail on. fsync is off: the rename still guarantees a reader
  // never sees a partial entry, and a power-loss hole is just a cache
  // miss — not worth ~4ms of fsync per icon on a 30k-icon warmup.
  await writeFileAtomic(target, content, { fsync: false });
}
