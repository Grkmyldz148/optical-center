/**
 * Property-style sweep over the entire shared fixture pool. Every icon
 * must:
 *   1. Parse and rasterize without throwing.
 *   2. Produce finite numeric offsets.
 *   3. Yield a valid viewBox string (4 numeric tokens).
 *   4. Match its measured `magnitudeRef` within tolerancePercent.
 *   5. Match its `clipExpected` flag exactly.
 *
 * Same SVGs power the example projects. A regression here is also a
 * regression in every demo — that's the point of the shared pool.
 */

import { describe, expect, it } from 'vitest';

import { transformViewBoxFromSvg } from '../../src/node/transform-viewbox-from-svg.js';
import {
  getTolerancePercent,
  listIcons,
  loadIcon,
} from '../helpers/fixtures.js';

const VIEWBOX_TOKEN = /^-?\d+(\.\d+)?$/;

describe('fixture pool — every icon survives the pipeline', () => {
  for (const icon of listIcons()) {
    it(`${icon.id} → finite, deterministic, valid viewBox`, () => {
      const svg = loadIcon(icon.id);
      const a = transformViewBoxFromSvg(svg);
      const b = transformViewBoxFromSvg(svg);

      expect(a.viewBox).toBe(b.viewBox);
      expect(Number.isFinite(a.offset.dxPercent)).toBe(true);
      expect(Number.isFinite(a.offset.dyPercent)).toBe(true);

      const tokens = a.viewBox.split(/\s+/);
      expect(tokens).toHaveLength(4);
      for (const tok of tokens) expect(tok).toMatch(VIEWBOX_TOKEN);
    });
  }
});

describe('fixture pool — magnitudes track manifest reference', () => {
  const tolerance = getTolerancePercent() / 100;
  for (const icon of listIcons()) {
    it(`${icon.id} ≈ ${icon.magnitudeRef}% (±${tolerance * 100}%)`, () => {
      const r = transformViewBoxFromSvg(loadIcon(icon.id));
      const magnitude = Math.hypot(r.offset.dxPercent, r.offset.dyPercent);
      // Absolute floor of 0.5% so near-zero references don't blow up
      // the relative tolerance (e.g. heroicons/home-solid at 0.08%).
      const allowed = Math.max(icon.magnitudeRef * tolerance, 0.5);
      expect(magnitude).toBeGreaterThanOrEqual(icon.magnitudeRef - allowed);
      expect(magnitude).toBeLessThanOrEqual(icon.magnitudeRef + allowed);
    });
  }
});

describe('fixture pool — clip detection matches manifest', () => {
  for (const icon of listIcons()) {
    it(`${icon.id} clip:${icon.clipExpected}`, () => {
      const r = transformViewBoxFromSvg(loadIcon(icon.id));
      expect(r.clipDetected).toBe(icon.clipExpected);
    });
  }
});
