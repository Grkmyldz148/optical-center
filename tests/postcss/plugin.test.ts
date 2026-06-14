/**
 * PostCSS plugin contract: a rule that contains
 * `optical-center: auto;` (or `--optical-center: auto;`) gets every
 * `url('…svg')` in its other declarations rewritten to an inline
 * `data:image/svg+xml,…` URI. The directive itself is stripped from
 * the output. Pulls SVGs from the shared fixture pool so tests stay
 * in sync with what examples render.
 */

import { describe, expect, it } from 'vitest';
import postcss from 'postcss';

import opticalCenterPostcss from '../../src/postcss/index.js';
import { iconPath, loadIcon } from '../helpers/fixtures.js';

const FIXTURES_ROOT = iconPath('lucide/play').replace(/\/lucide\/play\.svg$/, '');

async function run(
  css: string,
  options?: Parameters<typeof opticalCenterPostcss>[0],
  from?: string,
): Promise<{ css: string; warnings: ReadonlyArray<string> }> {
  const result = await postcss([opticalCenterPostcss(options)]).process(css, {
    from: from ?? '/virtual/styles.css',
  });
  return {
    css: result.css,
    warnings: result.warnings().map((w) => w.text),
  };
}

function decodeDataUri(uri: string): string {
  const match = uri.match(/^data:image\/svg\+xml;utf8,(.*)$/);
  if (!match) throw new Error(`not a data URI: ${uri.slice(0, 80)}…`);
  return decodeURIComponent(match[1]!);
}

function pickDataUri(css: string): string {
  const match = css.match(/url\("(data:image\/svg\+xml;utf8,[^"]+)"\)/);
  if (!match) throw new Error(`no data URI found in:\n${css}`);
  return match[1]!;
}

describe('opticalCenterPostcss', () => {
  it('rewrites url() in a rule that opts in via optical-center: auto', async () => {
    const css = `
      .icon {
        background-image: url('${iconPath('lucide/play')}');
        optical-center: auto;
      }
    `;
    const { css: out } = await run(css);

    expect(out).toContain('data:image/svg+xml;utf8,');
    // Bare directive is replaced by a `--optical-center: auto` tracer
    // custom property so DevTools shows the rule was processed.
    expect(out).not.toMatch(/(?<!-)optical-center\s*:\s*auto/);
    expect(out).toMatch(/--optical-center\s*:\s*auto/);

    const svg = decodeDataUri(pickDataUri(out));
    expect(svg).toMatch(/<svg[^>]*viewBox="-?\d+(\.\d+)?\s+-?\d+(\.\d+)?\s+\d+\s+\d+"/);
    expect(svg).toContain('<polygon');
  });

  it('also accepts the --optical-center custom-property form', async () => {
    const css = `
      .icon {
        background-image: url('${iconPath('lucide/play')}');
        --optical-center: auto;
      }
    `;
    const { css: out } = await run(css);
    expect(out).toContain('data:image/svg+xml;utf8,');
    // Tracer form replaces the input (same property name, value preserved).
    expect(out).toMatch(/--optical-center\s*:\s*auto/);
  });

  it('leaves rules without the directive untouched', async () => {
    const css = `.icon { background-image: url('${iconPath('lucide/play')}'); }`;
    const { css: out } = await run(css);
    expect(out).toBe(css);
  });

  it('does not process rules whose value is not "auto"', async () => {
    const css = `
      .icon {
        background-image: url('${iconPath('lucide/play')}');
        optical-center: none;
      }
    `;
    const { css: out } = await run(css);
    expect(out).not.toContain('data:image/svg+xml');
    expect(out).toContain('optical-center: none');
  });

  it('rewrites every url() in the rule, not just the first', async () => {
    const css = `
      .icon {
        background-image: url('${iconPath('lucide/play')}');
        mask-image: url('${iconPath('feather/camera')}');
        optical-center: auto;
      }
    `;
    const { css: out } = await run(css);
    const dataUris = out.match(/data:image\/svg\+xml;utf8,[^"]+/g);
    expect(dataUris).toHaveLength(2);
  });

  it('handles multiple url() inside a single declaration value', async () => {
    const css = `
      .icon {
        background-image:
          url('${iconPath('lucide/play')}'),
          url('${iconPath('feather/camera')}');
        optical-center: auto;
      }
    `;
    const { css: out } = await run(css);
    const dataUris = out.match(/data:image\/svg\+xml;utf8,[^"]+/g);
    expect(dataUris).toHaveLength(2);
  });

  it('processes the background shorthand too', async () => {
    const css = `
      .icon {
        background: #fff url('${iconPath('lucide/play')}') center / contain no-repeat;
        optical-center: auto;
      }
    `;
    const { css: out } = await run(css);
    expect(out).toContain('data:image/svg+xml;utf8,');
    expect(out).toContain('center / contain');
    expect(out).toContain('#fff');
  });

  it('resolves alias prefixes', async () => {
    const css = `
      .icon {
        mask-image: url('@fixtures/icons/heroicons/bell-solid.svg');
        optical-center: auto;
      }
    `;
    const { css: out } = await run(css, {
      aliases: { '@fixtures': FIXTURES_ROOT.replace(/\/icons$/, '') },
    });
    const svg = decodeDataUri(pickDataUri(out));
    expect(svg).toContain('viewBox=');
  });

  it('treats every rule independently — sibling without directive is untouched', async () => {
    const css = `
      .a {
        background-image: url('${iconPath('lucide/play')}');
        optical-center: auto;
      }
      .b {
        background-image: url('${iconPath('lucide/play')}');
      }
    `;
    const { css: out } = await run(css);
    const dataUris = out.match(/data:image\/svg\+xml;utf8,[^"]+/g);
    expect(dataUris).toHaveLength(1);
    expect(out).toMatch(/\.b \{[^}]*url\('[^']+lucide\/play\.svg'\)/);
  });

  it('emits a PostCSS warning on unresolvable path, leaves value untouched', async () => {
    const css = `
      .icon {
        background-image: url('/no/such/file.svg');
        optical-center: auto;
      }
    `;
    const { css: out, warnings } = await run(css);
    expect(out).not.toContain('data:image/svg+xml');
    expect(out).toContain('/no/such/file.svg');
    expect(warnings.some((w) => w.includes('failed to read'))).toBe(true);
  });

  it('resolves paths relative to the source CSS file', async () => {
    const css = `
      .icon {
        background-image: url('./play.svg');
        optical-center: auto;
      }
    `;
    const { css: out } = await run(css, undefined, iconPath('lucide/__styles.css'));
    const svg = decodeDataUri(pickDataUri(out));
    expect(svg).toContain('<polygon');
  });

  it('shifts the viewBox compared to the original SVG', async () => {
    const original = loadIcon('lucide/play');
    const css = `
      .icon {
        background-image: url('${iconPath('lucide/play')}');
        optical-center: auto;
      }
    `;
    const { css: out } = await run(css);
    const transformed = decodeDataUri(pickDataUri(out));

    const originalBox = original.match(/viewBox="([^"]+)"/)![1]!;
    const transformedBox = transformed.match(/viewBox="([^"]+)"/)![1]!;

    expect(transformedBox).not.toBe(originalBox);
  });

  it('reports a clip warning when the SVG content sits at the edge', async () => {
    const warnings: Array<{ code: string; location?: string }> = [];
    const css = `
      .icon {
        background-image: url('${iconPath('edge-cases/asymmetric-triangle')}');
        optical-center: auto;
      }
    `;
    await run(css, { onWarning: (w) => warnings.push(w) });
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain('OPTICAL_CLIP_DETECTED');
  });

  it('resolves bare specifiers via node_modules (no alias needed)', async () => {
    // Use the package's own package.json — guaranteed to exist,
    // mimics how `lucide-static/icons/play.svg` would resolve.
    const css = `
      .icon {
        background-image: url('postcss/package.json');
        optical-center: auto;
      }
    `;
    const { css: out, warnings } = await run(css);
    // package.json isn't an SVG so the rewrite will fail gracefully —
    // we only need to verify that resolution found the file (no
    // "failed to read" warning, just an SVG parse error).
    expect(warnings.some((w) => w.includes('failed to read'))).toBe(false);
  });

  it('skips http(s) urls without throwing', async () => {
    const css = `
      .a {
        background-image: url('https://example.com/x.svg');
        optical-center: auto;
      }
    `;
    const { css: out, warnings } = await run(css);
    expect(out).toContain('https://example.com/x.svg');
    expect(warnings.some((w) => w.includes('unresolvable'))).toBe(true);
  });
});
