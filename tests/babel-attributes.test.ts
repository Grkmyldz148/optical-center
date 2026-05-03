import { describe, expect, it } from 'vitest';

import { jsxAttrNameToSvg } from '../src/babel/attributes.js';

describe('jsxAttrNameToSvg', () => {
  it('preserves canonical SVG camelCase names', () => {
    expect(jsxAttrNameToSvg('viewBox')).toBe('viewBox');
    expect(jsxAttrNameToSvg('preserveAspectRatio')).toBe('preserveAspectRatio');
    expect(jsxAttrNameToSvg('gradientUnits')).toBe('gradientUnits');
    expect(jsxAttrNameToSvg('gradientTransform')).toBe('gradientTransform');
    expect(jsxAttrNameToSvg('refX')).toBe('refX');
    expect(jsxAttrNameToSvg('refY')).toBe('refY');
  });

  it('converts plain camelCase to kebab-case', () => {
    expect(jsxAttrNameToSvg('strokeWidth')).toBe('stroke-width');
    expect(jsxAttrNameToSvg('strokeLinecap')).toBe('stroke-linecap');
    expect(jsxAttrNameToSvg('fillOpacity')).toBe('fill-opacity');
  });

  it('maps namespaced JSX names to colon-separated forms', () => {
    expect(jsxAttrNameToSvg('xlinkHref')).toBe('xlink:href');
    expect(jsxAttrNameToSvg('xmlnsXlink')).toBe('xmlns:xlink');
    expect(jsxAttrNameToSvg('xmlSpace')).toBe('xml:space');
  });

  it('passes already-lowercase names through unchanged', () => {
    expect(jsxAttrNameToSvg('width')).toBe('width');
    expect(jsxAttrNameToSvg('d')).toBe('d');
    expect(jsxAttrNameToSvg('fill')).toBe('fill');
  });
});
