/**
 * Synchronous shim over the build-time cache for the Babel visitor.
 *
 * The async TransformCache is the canonical store, but Babel's
 * JSXElement visitor is synchronous — it can't `await`. This module
 * provides a strictly-sync read-through layer:
 *
 *   - L1: process-local LRU keyed on cache hash (shared across files
 *     in the same Babel run; same lifetime as the plugin instance).
 *   - L2: synchronous read from the on-disk cache directory written
 *     by the async cache. Hits become L1.
 *   - On miss: caller computes the value, then writes it back via
 *     the async cache so other consumers (CLI, ?optical asset loads)
 *     see the same entry.
 *
 * The L2 reader and writer share the on-disk format with TransformCache
 * by going through the exact same key derivation, so Babel-warmed
 * entries are picked up by the CLI and vice versa.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

import { ALGORITHM_VERSION } from '../core/version.js';

import { computeCacheKey, defaultCacheDir } from '../cache/index.js';

export interface SyncCacheOptions {
  readonly dir?: string;
  readonly l1Capacity?: number;
}

interface DiskEntry<T> {
  readonly v: 1;
  readonly key: string;
  readonly algorithmVersion: string;
  readonly computedAt: string;
  readonly value: T;
}

const DEFAULT_L1_CAPACITY = 1000;

export class SyncTransformCache<T> {
  private readonly dir: string;
  private readonly l1: Map<string, T> = new Map();
  private readonly l1Capacity: number;
  readonly stats = { l1Hits: 0, l2Hits: 0, misses: 0, writes: 0, writeFailures: 0 };

  constructor(options?: SyncCacheOptions) {
    this.dir = join(options?.dir ?? defaultCacheDir(), ALGORITHM_VERSION);
    this.l1Capacity = options?.l1Capacity ?? DEFAULT_L1_CAPACITY;
  }

  get(svg: string): { key: string; value: T | null } {
    const key = computeCacheKey(svg);

    const memoized = this.l1.get(key);
    if (memoized !== undefined) {
      this.l1.delete(key);
      this.l1.set(key, memoized);
      this.stats.l1Hits++;
      return { key, value: memoized };
    }

    try {
      const raw = readFileSync(this.entryPath(key), 'utf8');
      const entry = JSON.parse(raw) as DiskEntry<T>;
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

  set(svg: string, value: T): { key: string; written: boolean } {
    const key = computeCacheKey(svg);
    this.promoteL1(key, value);

    const entry: DiskEntry<T> = {
      v: 1,
      key,
      algorithmVersion: ALGORITHM_VERSION,
      computedAt: new Date().toISOString(),
      value,
    };

    try {
      const target = this.entryPath(key);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, JSON.stringify(entry));
      this.stats.writes++;
      return { key, written: true };
    } catch {
      this.stats.writeFailures++;
      return { key, written: false };
    }
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
