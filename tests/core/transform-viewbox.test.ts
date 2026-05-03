import { describe, expect, it } from 'vitest';

import {
  applyOffsetToViewBox,
  getRasterBbox,
  transformViewBox,
} from '../../src/core/transform-viewbox.js';
import type { ViewBoxNumeric } from '../../src/core/types.js';
import { emptyRaster, rasterWithBlock } from '../helpers/raster.js';

describe('applyOffsetToViewBox', () => {
  it('shifts the window opposite the visual offset (sign convention)', () => {
    const original: ViewBoxNumeric = { x: 0, y: 0, w: 24, h: 24 };
    const result = applyOffsetToViewBox(original, {
      dxPercent: 5,
      dyPercent: 2,
    });
    // dxPercent=5 → window slides LEFT by 5% of W → x = 0 - (0.05 * 24) = -1.2
    expect(result.x).toBeCloseTo(-1.2, 10);
    expect(result.y).toBeCloseTo(-0.48, 10);
    expect(result.w).toBe(24);
    expect(result.h).toBe(24);
  });

  it('preserves width and height (size never changes)', () => {
    const original: ViewBoxNumeric = { x: 5, y: 5, w: 100, h: 50 };
    const result = applyOffsetToViewBox(original, {
      dxPercent: 10,
      dyPercent: -5,
    });
    expect(result.w).toBe(100);
    expect(result.h).toBe(50);
  });

  it('returns the input unchanged for a zero offset', () => {
    const original: ViewBoxNumeric = { x: 1, y: 2, w: 24, h: 24 };
    expect(
      applyOffsetToViewBox(original, { dxPercent: 0, dyPercent: 0 }),
    ).toEqual(original);
  });
});

describe('transformViewBox', () => {
  const offset = { dxPercent: 1.5, dyPercent: 0.5 };
  const raster = rasterWithBlock({ x: 6, y: 6, w: 12, h: 12 });

  it('produces a deterministic viewBox string', () => {
    const svg = '<svg viewBox="0 0 24 24"></svg>';
    const a = transformViewBox(svg, raster, offset);
    const b = transformViewBox(svg, raster, offset);
    expect(a.viewBox).toBe(b.viewBox);
    expect(a.viewBox).toBe('-0.36 -0.12 24 24');
  });

  it('omits metadata attributes by default', () => {
    const result = transformViewBox(
      '<svg viewBox="0 0 24 24"></svg>',
      raster,
      offset,
    );
    expect(result.breadcrumb).toEqual({ 'data-optical-center': '' });
  });

  it('emits metadata attributes when emitMetadata is true', () => {
    const result = transformViewBox(
      '<svg viewBox="0 0 24 24"></svg>',
      raster,
      offset,
      { emitMetadata: true },
    );
    expect(result.breadcrumb['data-optical-original-viewbox']).toBe('0 0 24 24');
    expect(result.breadcrumb['data-optical-offset']).toBe('1.5% 0.5%');
  });

  it('flags clipDetected when the shifted window crops opaque pixels', () => {
    // dxPercent=5 slides the window LEFT; a block flush against the right
    // edge will fall outside the new (right-shrunk) window.
    const flushRight = rasterWithBlock({ x: 18, y: 6, w: 6, h: 12 });
    const result = transformViewBox(
      '<svg viewBox="0 0 24 24"></svg>',
      flushRight,
      { dxPercent: 5, dyPercent: 0 },
    );
    expect(result.clipDetected).toBe(true);
  });

  it('does not flag clipDetected when content is comfortably inside', () => {
    const result = transformViewBox(
      '<svg viewBox="0 0 24 24"></svg>',
      raster,
      offset,
    );
    expect(result.clipDetected).toBe(false);
  });

  it('handles SVGs without an explicit viewBox via width/height', () => {
    const svg = '<svg width="24" height="24"></svg>';
    const result = transformViewBox(svg, raster, offset);
    // Same math, derived viewBox 0 0 24 24
    expect(result.viewBox).toBe('-0.36 -0.12 24 24');
  });
});

describe('getRasterBbox', () => {
  it('returns null for a fully transparent raster', () => {
    expect(getRasterBbox(emptyRaster())).toBeNull();
  });

  it('returns the half-open bbox of opaque pixels', () => {
    const raster = rasterWithBlock({ x: 4, y: 6, w: 10, h: 8 });
    expect(getRasterBbox(raster)).toEqual({
      minX: 4,
      minY: 6,
      maxX: 14,
      maxY: 14,
    });
  });
});
