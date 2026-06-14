/**
 * Smoke tests for the algorithmic core. The model is treated as a
 * black box here — we don't re-derive the math, just pin down its
 * contract: deterministic, finite, and reactive to asymmetry.
 */

import { describe, expect, it } from 'vitest';

import { CORRECTION_SCALE, getOpticalCenter } from '../../src/model/index.js';
import { emptyRaster, rasterWithBlock } from '../helpers/raster.js';

describe('getOpticalCenter', () => {
  it('returns zero offset for a fully transparent raster', () => {
    const result = getOpticalCenter(emptyRaster());
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
  });

  it('returns small offset for a near-symmetric centered block', () => {
    // The pipeline (DoG, symmetry correction, vertical bias) introduces
    // small but non-zero offsets even for geometrically symmetric input.
    // We just bound the magnitude (in pixels, < 5% of side) to make sure
    // nothing has blown up.
    const centered = rasterWithBlock({ x: 8, y: 8, w: 8, h: 8 });
    const result = getOpticalCenter(centered);
    expect(Math.abs(result.dx) / centered.width).toBeLessThan(0.05);
    expect(Math.abs(result.dy) / centered.height).toBeLessThan(0.05);
  });

  it('produces non-zero offset for an off-center block', () => {
    const off = rasterWithBlock({ x: 2, y: 8, w: 8, h: 8 });
    const result = getOpticalCenter(off);
    expect(Math.abs(result.dx)).toBeGreaterThan(0);
  });

  it('is deterministic — same input → same output', () => {
    const raster = rasterWithBlock({ x: 4, y: 6, w: 12, h: 8 });
    const a = getOpticalCenter(raster);
    const b = getOpticalCenter(raster);
    expect(a).toEqual(b);
  });

  it('produces finite numbers for any non-empty input', () => {
    const raster = rasterWithBlock({ x: 1, y: 1, w: 22, h: 22 });
    const r = getOpticalCenter(raster);
    expect(Number.isFinite(r.dx)).toBe(true);
    expect(Number.isFinite(r.dy)).toBe(true);
  });

  it('scales by the documented Phase-2 PSE constant', () => {
    expect(CORRECTION_SCALE).toBe(0.745);
  });
});
