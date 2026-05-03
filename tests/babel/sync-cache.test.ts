import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SyncTransformCache } from '../../src/babel/sync-cache.js';

describe('SyncTransformCache', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'oc-sync-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips a value through L1', () => {
    const cache = new SyncTransformCache<{ x: number }>({ dir });
    cache.set('<svg/>', { x: 1 });
    const r = cache.get('<svg/>');
    expect(r.value).toEqual({ x: 1 });
    expect(cache.stats.l1Hits).toBe(1);
  });

  it('reads from L2 when L1 is cold', () => {
    const a = new SyncTransformCache<{ x: number }>({ dir });
    a.set('<svg/>', { x: 42 });

    const b = new SyncTransformCache<{ x: number }>({ dir });
    const r = b.get('<svg/>');
    expect(r.value).toEqual({ x: 42 });
    expect(b.stats.l2Hits).toBe(1);
  });

  it('returns null on miss', () => {
    const cache = new SyncTransformCache<{ x: number }>({ dir });
    expect(cache.get('<svg/>').value).toBeNull();
    expect(cache.stats.misses).toBe(1);
  });

  it('evicts the oldest entry once L1 is full', () => {
    const cache = new SyncTransformCache<{ x: number }>({ dir, l1Capacity: 2 });
    cache.set('a', { x: 1 });
    cache.set('b', { x: 2 });
    cache.set('c', { x: 3 });
    // 'a' was evicted from L1 but persists on disk → L2 hit.
    const r = cache.get('a');
    expect(r.value).toEqual({ x: 1 });
    expect(cache.stats.l2Hits).toBe(1);
  });
});
