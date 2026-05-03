import { describe, expect, it } from 'vitest';

import { runBabel } from '../helpers/babel-runner.js';

const runPlugin = (input: string, emitMetadata = false) =>
  runBabel(input, { emitMetadata });

describe('optical-center Babel plugin', () => {
  it('rewrites viewBox on <svg opticalCenter>', () => {
    const out = runPlugin(
      'const X = <svg opticalCenter viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
    );
    expect(out.code).toMatch(/viewBox="-?\d+\.?\d*\s+-?\d+\.?\d*\s+24\s+24"/);
    expect(out.code).toContain('data-optical-center=""');
    expect(out.code).not.toContain('opticalCenter');
    expect(out.warnings).toEqual([]);
  });

  it('accepts opticalCenter="auto" the same as the boolean form', () => {
    const out = runPlugin(
      'const X = <svg opticalCenter="auto" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
    );
    expect(out.code).toContain('data-optical-center=""');
    expect(out.code).not.toContain('opticalCenter');
  });

  it('leaves opticalCenter={false} alone (disabled)', () => {
    const out = runPlugin(
      'const X = <svg opticalCenter={false} viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
    );
    expect(out.code).toContain('opticalCenter={false}');
    expect(out.code).not.toContain('data-optical-center');
    expect(out.warnings).toEqual([]);
  });

  it('skips SVGs without the opticalCenter prop', () => {
    const out = runPlugin(
      'const X = <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
    );
    expect(out.code).not.toContain('data-optical-center');
    expect(out.warnings).toEqual([]);
  });

  it('emits metadata attributes when emitMetadata is true', () => {
    const out = runPlugin(
      'const X = <svg opticalCenter viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
      true,
    );
    expect(out.code).toContain('data-optical-original-viewbox="0 0 24 24"');
    expect(out.code).toMatch(/data-optical-offset="[\d.%-]+ [\d.%-]+"/);
  });

  it('bails out on dynamic children (OPTICAL_DYNAMIC_SVG)', () => {
    const out = runPlugin(
      'const X = <svg opticalCenter viewBox="0 0 24 24">{children}</svg>;',
    );
    expect(out.code).toContain('opticalCenter');
    expect(out.code).not.toContain('data-optical-center');
    expect(out.warnings.map((w) => w.code)).toContain('OPTICAL_DYNAMIC_SVG');
  });

  it('bails out on JSXSpreadAttribute (OPTICAL_SPREAD_PROPS)', () => {
    const out = runPlugin(
      'const X = <svg {...rest} viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
    );
    expect(out.warnings.map((w) => w.code)).toContain('OPTICAL_SPREAD_PROPS');
    expect(out.code).not.toContain('data-optical-center');
  });

  it('bails out on dynamic viewBox', () => {
    const out = runPlugin(
      'const X = <svg opticalCenter viewBox={vb}><path d="M8 5v14l11-7z"/></svg>;',
    );
    expect(out.warnings.map((w) => w.code)).toContain('OPTICAL_DYNAMIC_SVG');
  });

  it('preserves a child element with kebab-cased SVG attributes', () => {
    const out = runPlugin(
      'const X = <svg opticalCenter viewBox="0 0 24 24"><path strokeWidth="2" d="M0 0L24 24"/></svg>;',
    );
    // The serialized SVG fed to resvg used kebab-case; the AST keeps camelCase.
    expect(out.code).toContain('strokeWidth');
    expect(out.code).toContain('data-optical-center');
  });

  it('is idempotent — running twice produces the same output', () => {
    const input =
      'const X = <svg opticalCenter viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;';
    const first = runPlugin(input);
    const second = runPlugin(first.code);
    // Once stripped, opticalCenter is gone; second pass is a no-op.
    expect(second.code.replace(/\s+/g, ' ').trim()).toBe(
      first.code.replace(/\s+/g, ' ').trim(),
    );
  });
});
