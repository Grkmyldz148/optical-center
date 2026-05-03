import { describe, expect, it } from 'vitest';

import {
  formatViewBox,
  parseViewBoxFromSvg,
  parseViewBoxString,
} from '../src/core/parse-viewbox.js';

describe('parseViewBoxString', () => {
  it('parses space-separated values', () => {
    expect(parseViewBoxString('0 0 24 24')).toEqual({
      x: 0,
      y: 0,
      w: 24,
      h: 24,
    });
  });

  it('parses comma-separated values', () => {
    expect(parseViewBoxString('1,2,3,4')).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it('parses mixed separators', () => {
    expect(parseViewBoxString('  -10, 5  100  50  ')).toEqual({
      x: -10,
      y: 5,
      w: 100,
      h: 50,
    });
  });

  it('rejects malformed input', () => {
    expect(parseViewBoxString('0 0 24')).toBeNull();
    expect(parseViewBoxString('not numbers at all')).toBeNull();
    expect(parseViewBoxString('')).toBeNull();
  });

  it('rejects non-positive dimensions', () => {
    expect(parseViewBoxString('0 0 0 24')).toBeNull();
    expect(parseViewBoxString('0 0 24 -1')).toBeNull();
  });
});

describe('parseViewBoxFromSvg', () => {
  it('reads a viewBox attribute on the root element', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    expect(parseViewBoxFromSvg(svg)).toEqual({
      viewBox: { x: 0, y: 0, w: 24, h: 24 },
      source: 'attribute',
    });
  });

  it('derives a viewBox from width/height when missing', () => {
    const svg = '<svg width="48" height="48"><path d="M0 0"/></svg>';
    expect(parseViewBoxFromSvg(svg)).toEqual({
      viewBox: { x: 0, y: 0, w: 48, h: 48 },
      source: 'derived',
    });
  });

  it('falls back to 100x100 default when nothing is present', () => {
    expect(parseViewBoxFromSvg('<svg></svg>')).toEqual({
      viewBox: { x: 0, y: 0, w: 100, h: 100 },
      source: 'default',
    });
  });

  it('prefers viewBox over width/height when both exist', () => {
    const svg = '<svg viewBox="0 0 24 24" width="48" height="48"></svg>';
    expect(parseViewBoxFromSvg(svg).source).toBe('attribute');
    expect(parseViewBoxFromSvg(svg).viewBox).toEqual({ x: 0, y: 0, w: 24, h: 24 });
  });
});

describe('formatViewBox', () => {
  it('keeps integers integer', () => {
    expect(formatViewBox({ x: 0, y: 0, w: 24, h: 24 })).toBe('0 0 24 24');
  });

  it('rounds to four decimals and strips trailing zeros', () => {
    // 0.5 in the 5th decimal is round-half-to-even territory across engines,
    // so use a non-ambiguous value to keep the assertion deterministic.
    expect(formatViewBox({ x: -0.322698, y: 0, w: 24, h: 24 })).toBe(
      '-0.3227 0 24 24',
    );
    expect(formatViewBox({ x: 1.5, y: 0, w: 24, h: 24 })).toBe('1.5 0 24 24');
  });

  it('round-trips parse → format for a non-trivial value', () => {
    const parsed = parseViewBoxString('-1.5 2 24 24');
    expect(parsed).not.toBeNull();
    expect(formatViewBox(parsed!)).toBe('-1.5 2 24 24');
  });
});
