/**
 * End-to-end smoke test through the resvg-backed pipeline. The other
 * suites use synthetic rasters; this one proves the full SVG → PNG →
 * bitmap → offset → viewBox chain works on real golden fixtures.
 */

import { describe, expect, it } from 'vitest';

import { transformViewBoxFromSvg } from '../../src/node/transform-viewbox-from-svg.js';
import { loadIcon } from '../helpers/fixtures.js';

describe('transformViewBoxFromSvg', () => {
  it('transforms the play icon (asymmetric) and produces a deterministic viewBox', () => {
    const svg = loadIcon('play');
    const a = transformViewBoxFromSvg(svg);
    const b = transformViewBoxFromSvg(svg);
    expect(a.viewBox).toBe(b.viewBox);
    expect(a.viewBox).toMatch(/^-?\d+(\.\d+)? -?\d+(\.\d+)? 24 24$/);
    expect(a.viewBox).not.toBe('0 0 24 24');
  });

  it('returns ~zero horizontal offset for a perfectly centered circle', () => {
    // A circle is horizontally and vertically symmetric, so dx should be
    // ~0. The model still applies a small perceptual vertical bias, so
    // dy is bounded but not necessarily zero.
    const svg = loadIcon('circle-centered');
    const result = transformViewBoxFromSvg(svg);
    expect(Math.abs(result.offset.dxPercent)).toBeLessThan(0.5);
    expect(Math.abs(result.offset.dyPercent)).toBeLessThan(5);
  });

  it('returns large offset for an asymmetric triangle', () => {
    const svg = loadIcon('triangle-asymmetric');
    const result = transformViewBoxFromSvg(svg);
    const magnitude = Math.hypot(
      result.offset.dxPercent,
      result.offset.dyPercent,
    );
    expect(magnitude).toBeGreaterThan(1);
  });

  it('emits metadata breadcrumbs when emitMetadata is true', () => {
    const result = transformViewBoxFromSvg(loadIcon('play'), {
      emitMetadata: true,
    });
    expect(result.breadcrumb['data-optical-original-viewbox']).toBeTruthy();
    expect(result.breadcrumb['data-optical-offset']).toBeTruthy();
  });

  it('handles SVGs that are missing xmlns (auto-injected for resvg)', () => {
    const noNs = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>';
    const result = transformViewBoxFromSvg(noNs);
    expect(result.viewBox).toMatch(/^-?\d/);
  });
});
