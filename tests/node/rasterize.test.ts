import { afterEach, describe, expect, it } from 'vitest';

import { initRasterizer, rasterizeSvg } from '../../src/node/rasterize.js';
import { Resvg } from '@resvg/resvg-js';

const PLAY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

describe('rasterizeSvg', () => {
  afterEach(() => {
    // Reset to the native binding after any test that swapped it.
    initRasterizer(Resvg as unknown as Parameters<typeof initRasterizer>[0]);
  });

  it('produces a non-empty RGBA buffer at the requested size', () => {
    const r = rasterizeSvg(PLAY_SVG, { size: 64 });
    expect(r.width).toBe(64);
    expect(r.height).toBe(64);
    expect(r.data.length).toBe(64 * 64 * 4);
    // The play triangle has opaque pixels somewhere.
    let opaque = 0;
    for (let i = 3; i < r.data.length; i += 4) if (r.data[i]! > 0) opaque++;
    expect(opaque).toBeGreaterThan(0);
  });

  it('rejects oversized input early with a clear message', () => {
    const huge = '<svg>' + 'x'.repeat(6_000_000) + '</svg>';
    expect(() => rasterizeSvg(huge)).toThrow(/MAX_INPUT_BYTES/);
  });

  it('initRasterizer swaps the backend (WASM-fallback hook)', () => {
    let called = false;
    class FakeResvg {
      constructor(_svg: string, _opts: unknown) {
        called = true;
      }
      render() {
        return {
          pixels: new Uint8ClampedArray(4),
          width: 1,
          height: 1,
        };
      }
    }
    initRasterizer(FakeResvg as unknown as Parameters<typeof initRasterizer>[0]);
    rasterizeSvg(PLAY_SVG, { size: 16 });
    expect(called).toBe(true);
  });
});
