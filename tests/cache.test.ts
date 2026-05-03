import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TransformCache, computeCacheKey } from '../src/cache.js';

describe('computeCacheKey', () => {
  it('produces a stable hex hash', () => {
    const a = computeCacheKey('<svg></svg>');
    const b = computeCacheKey('<svg></svg>');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when content changes (no normalization)', () => {
    const a = computeCacheKey('<svg></svg>');
    const b = computeCacheKey('<svg ></svg>'); // an extra space
    expect(a).not.toBe(b);
  });
});

describe('TransformCache', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'oc-cache-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns null on a fresh miss', async () => {
    const cache = new TransformCache<{ v: number }>({ dir });
    const { value } = await cache.get('<svg></svg>');
    expect(value).toBeNull();
    expect(cache.stats.misses).toBe(1);
  });

  it('round-trips a value through disk', async () => {
    const cache = new TransformCache<{ v: number }>({ dir });
    await cache.set('<svg></svg>', { v: 42 });

    const fresh = new TransformCache<{ v: number }>({ dir });
    const { value } = await fresh.get('<svg></svg>');
    expect(value).toEqual({ v: 42 });
    expect(fresh.stats.l2Hits).toBe(1);
  });

  it('hits L1 when the same key is read twice in-process', async () => {
    const cache = new TransformCache<{ v: number }>({ dir });
    await cache.set('<svg></svg>', { v: 1 });
    await cache.get('<svg></svg>'); // primes from disk → L2
    await cache.get('<svg></svg>'); // L1 hit
    expect(cache.stats.l1Hits).toBeGreaterThanOrEqual(1);
  });

  it('evicts the oldest entry when L1 is full', async () => {
    const cache = new TransformCache<{ v: number }>({ dir, l1Capacity: 2 });
    await cache.set('a', { v: 1 });
    await cache.set('b', { v: 2 });
    await cache.set('c', { v: 3 });

    // 'a' is no longer in L1 — but disk still has it, so this is L2.
    const a = await cache.get('a');
    expect(a.value).toEqual({ v: 1 });
    expect(cache.stats.l2Hits).toBe(1);
  });
});
