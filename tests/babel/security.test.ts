/**
 * Adversarial fixtures for the Babel plugin.
 *
 * The visitor refuses to rewrite anything that could let an attacker
 * smuggle dynamic content past the static-only contract. Each test
 * here sketches a way someone might try to bypass that and asserts
 * that the visitor bails out cleanly.
 */

import { describe, expect, it } from 'vitest';

import { runBabel } from '../helpers/babel-runner.js';

describe('Babel plugin — security & adversarial inputs', () => {
  it('refuses to process when opticalCenter is hidden behind a spread', () => {
    const result = runBabel(
      'const X = <svg {...{ opticalCenter: true }} viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
    );
    expect(result.code).not.toContain('data-optical-center');
    expect(result.warnings.map((w) => w.code)).toContain('OPTICAL_SPREAD_PROPS');
  });

  it('does not interpret a viewBox supplied via spread', () => {
    const result = runBabel(
      'const X = <svg opticalCenter {...rest}><path d="M8 5v14l11-7z"/></svg>;',
    );
    expect(result.code).not.toContain('data-optical-center');
    expect(result.warnings.map((w) => w.code)).toContain('OPTICAL_SPREAD_PROPS');
  });

  it('does not evaluate dynamic expressions inside opticalCenter prop', () => {
    const result = runBabel(
      'const X = <svg opticalCenter={someBoolean} viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
    );
    expect(result.code).not.toContain('data-optical-center');
    expect(result.warnings.map((w) => w.code)).toContain('OPTICAL_DYNAMIC_SVG');
  });

  it('refuses dynamic child expressions even if attributes are all static', () => {
    const result = runBabel(
      'const X = <svg opticalCenter viewBox="0 0 24 24"><path d={dynamicPath}/></svg>;',
    );
    expect(result.code).not.toContain('data-optical-center');
    expect(result.warnings.map((w) => w.code)).toContain('OPTICAL_DYNAMIC_SVG');
  });

  it('refuses fragments in children (could expand to dynamic JSX)', () => {
    const result = runBabel(
      'const X = <svg opticalCenter viewBox="0 0 24 24"><><path d="M0 0"/></></svg>;',
    );
    expect(result.code).not.toContain('data-optical-center');
    expect(result.warnings.map((w) => w.code)).toContain('OPTICAL_DYNAMIC_SVG');
  });

  it('refuses nested elements with spread attributes', () => {
    const result = runBabel(
      'const X = <svg opticalCenter viewBox="0 0 24 24"><path {...rest} d="M0 0"/></svg>;',
    );
    expect(result.code).not.toContain('data-optical-center');
    expect(result.warnings.map((w) => w.code)).toContain('OPTICAL_SPREAD_PROPS');
  });

  it('does not execute code from JSX string attributes (no eval)', () => {
    // Even if someone puts JS-like content in a string literal, it's
    // just a string — we serialize it as XML text content.
    const result = runBabel(
      `const X = <svg opticalCenter viewBox="0 0 24 24"><title>{"() => fetch('/steal')"}</title><path d="M8 5v14l11-7z"/></svg>;`,
    );
    // children expression triggers dynamic bail-out
    expect(result.code).not.toContain('data-optical-center');
    expect(result.warnings.map((w) => w.code)).toContain('OPTICAL_DYNAMIC_SVG');
  });
});
