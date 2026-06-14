import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Route the on-disk cache to a throwaway dir (set before the corrector's
// lazy cache is ever constructed).
process.env['OPTICAL_CACHE_DIR'] = mkdtempSync(join(tmpdir(), 'oc-corrector-'));

import { rasterizeSvg } from '../../src/node/rasterize.js';
import { transformViewBoxFromSvg } from '../../src/node/transform-viewbox-from-svg.js';
import { correctIcon, wrapBody, formatCoord } from '../../src/corrector/index.js';
import { correctCollection, correctSingleIcon, SENTINEL_KEY } from '../../src/corrector/iconify.js';

const BODY = '<path d="M8 5v14l11-7z"/>';
const SVG = (vb: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;

function meanAbsDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return n === 0 ? 0 : sum / n;
}

describe('correctIcon — sign + magnitude', () => {
  it('produces a body translate equal to (offset% / 100) · dimension', async () => {
    const original = SVG('0 0 24 24', BODY);
    const ref = transformViewBoxFromSvg(original);
    const shift = await correctIcon({ body: BODY, left: 0, top: 0, width: 24, height: 24 });

    expect(shift.dx).toBeCloseTo((ref.offset.dxPercent / 100) * 24, 4);
    expect(shift.dy).toBeCloseTo((ref.offset.dyPercent / 100) * 24, 4);
    // The play triangle leans right + down → positive shift on both axes.
    expect(Math.abs(shift.dx) + Math.abs(shift.dy)).toBeGreaterThan(0);
  });
});

describe('body-wrap ↔ viewBox-shift equivalence (the load-bearing claim)', () => {
  it('renders pixel-identically to shifting the viewBox', async () => {
    const original = SVG('0 0 24 24', BODY);
    const shiftedViewBox = transformViewBoxFromSvg(original).viewBox;
    expect(shiftedViewBox).not.toBe('0 0 24 24');

    const shift = await correctIcon({ body: BODY, left: 0, top: 0, width: 24, height: 24 });

    const viaViewBox = rasterizeSvg(SVG(shiftedViewBox, BODY));
    const viaBodyWrap = rasterizeSvg(SVG('0 0 24 24', wrapBody(BODY, shift)));

    expect(viaBodyWrap.width).toBe(viaViewBox.width);
    expect(viaBodyWrap.height).toBe(viaViewBox.height);
    // Identical final geometry → identical raster (allow a hair for AA).
    expect(meanAbsDiff(viaViewBox.data, viaBodyWrap.data)).toBeLessThan(0.5);
  });
});

describe('formatCoord', () => {
  it('is deterministic and normalises -0', () => {
    expect(formatCoord(0)).toBe('0');
    expect(formatCoord(-0)).toBe('0');
    expect(formatCoord(1.23456789)).toBe('1.2346');
    expect(formatCoord(2)).toBe('2');
  });
});

describe('correctCollection', () => {
  it('body-wraps icons in place, stamps a sentinel, and is idempotent', async () => {
    const set: Record<string, unknown> = {
      prefix: 'demo',
      width: 24,
      height: 24,
      icons: { play: { body: BODY } },
    };

    const stats = await correctCollection(set);
    expect(stats.total).toBe(1);
    expect(stats.corrected).toBe(1);

    const icons = set['icons'] as Record<string, Record<string, unknown>>;
    expect(icons['play']?.['body']).toContain('<g transform="translate(');
    expect(typeof set[SENTINEL_KEY]).toBe('string');

    const snapshot = JSON.stringify(set);
    const again = await correctCollection(set);
    expect(again.total).toBe(0); // sentinel short-circuit — no second pass
    expect(JSON.stringify(set)).toBe(snapshot); // no double-wrap
  });
});

describe('correctSingleIcon', () => {
  it('body-wraps a single-icon object and stamps the sentinel', async () => {
    const icon: Record<string, unknown> = { body: BODY, width: 24, height: 24 };
    const changed = await correctSingleIcon(icon);
    expect(changed).toBe(true);
    expect(icon['body']).toContain('<g transform="translate(');
    expect(typeof icon[SENTINEL_KEY]).toBe('string');
  });
});
