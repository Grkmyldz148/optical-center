import { describe, expect, it } from 'vitest';

import { sanitizeSvg } from '../../src/node/sanitize.js';

describe('sanitizeSvg', () => {
  it('strips inline event handlers', () => {
    const dirty =
      '<svg onload="alert(1)" viewBox="0 0 24 24"><path onclick="evil()" d="M0 0"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/onload/);
    expect(clean).not.toMatch(/onclick/);
    expect(clean).toContain('viewBox="0 0 24 24"');
    expect(clean).toContain('d="M0 0"');
  });

  it('removes <script> blocks completely', () => {
    const dirty =
      '<svg viewBox="0 0 24 24"><script>fetch("/steal")</script><path d="M0 0"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('fetch');
    expect(clean).toContain('<path d="M0 0"/>');
  });

  it('removes self-closing <script /> tags', () => {
    const dirty = '<svg viewBox="0 0 24 24"><script src="/x.js"/></svg>';
    expect(sanitizeSvg(dirty)).not.toContain('script');
  });

  it('rewrites javascript: URIs in href and xlink:href', () => {
    const dirty =
      '<svg viewBox="0 0 24 24"><a href="javascript:alert(1)" xlink:href="javascript:evil()"><path d="M0 0"/></a></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).toContain('href="#"');
  });

  it('removes foreignObject blocks', () => {
    const dirty =
      '<svg viewBox="0 0 24 24"><foreignObject><iframe src="evil"></iframe></foreignObject><path d="M0 0"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain('foreignObject');
    expect(clean).not.toContain('iframe');
    expect(clean).toContain('<path d="M0 0"/>');
  });

  it('respects opt-out flags', () => {
    const dirty = '<svg onload="x()"><script>y()</script></svg>';
    const keepHandlers = sanitizeSvg(dirty, { stripEventHandlers: false });
    expect(keepHandlers).toContain('onload');
    expect(keepHandlers).not.toContain('script');

    const keepScripts = sanitizeSvg(dirty, { stripScripts: false });
    expect(keepScripts).not.toContain('onload');
    expect(keepScripts).toContain('<script');
  });

  it('is a no-op for clean input', () => {
    const clean = '<svg viewBox="0 0 24 24"><path d="M0 0L24 24"/></svg>';
    expect(sanitizeSvg(clean)).toBe(clean);
  });
});
