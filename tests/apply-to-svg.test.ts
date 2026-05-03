import { describe, expect, it } from 'vitest';

import { applyTransformToSvg } from '../src/core/apply-to-svg.js';

describe('applyTransformToSvg', () => {
  const patch = {
    viewBox: '-0.32 -0.62 24 24',
    breadcrumb: { 'data-optical-center': '' as const },
  };

  it('replaces an existing viewBox attribute', () => {
    const svg = '<svg xmlns="x" viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    const out = applyTransformToSvg(svg, patch);
    expect(out).toContain('viewBox="-0.32 -0.62 24 24"');
    expect(out).not.toContain('viewBox="0 0 24 24"');
    expect(out).toContain('data-optical-center=""');
  });

  it('adds viewBox when none is present', () => {
    const svg = '<svg xmlns="x" width="24" height="24"></svg>';
    const out = applyTransformToSvg(svg, patch);
    expect(out).toContain('viewBox="-0.32 -0.62 24 24"');
  });

  it('is idempotent — re-applying the same patch produces the same output', () => {
    const svg = '<svg viewBox="0 0 24 24"></svg>';
    const a = applyTransformToSvg(svg, patch);
    const b = applyTransformToSvg(a, patch);
    expect(b).toBe(a);
  });

  it('preserves path data byte-for-byte', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    const out = applyTransformToSvg(svg, patch);
    expect(out).toContain('<path d="M8 5v14l11-7z"/>');
  });

  it('emits metadata attributes when included in the patch', () => {
    const out = applyTransformToSvg('<svg viewBox="0 0 24 24"></svg>', {
      viewBox: '-0.5 0 24 24',
      breadcrumb: {
        'data-optical-center': '',
        'data-optical-original-viewbox': '0 0 24 24',
        'data-optical-offset': '2% 0%',
      },
    });
    expect(out).toContain('data-optical-original-viewbox="0 0 24 24"');
    expect(out).toContain('data-optical-offset="2% 0%"');
  });

  it('throws when no <svg> tag is present', () => {
    expect(() => applyTransformToSvg('<not-svg />', patch)).toThrow(
      /no <svg> opening tag/i,
    );
  });
});
