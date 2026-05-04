/**
 * PostCSS plugin contract: every `url('…svg?optical')` in declaration
 * values is replaced with an inline `data:image/svg+xml,…` URI whose
 * SVG has a rewritten viewBox. Pulls SVGs from the shared fixture
 * pool so tests stay in sync with what examples render.
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
  it('rewrites a background-image url with ?optical to a data URI', async () => {
    const css = `.icon { background-image: url('${iconPath('lucide/play')}?optical'); }`;
    const { css: out } = await run(css);

    expect(out).toContain('data:image/svg+xml;utf8,');
    expect(out).not.toContain('?optical');

    const svg = decodeDataUri(pickDataUri(out));
    expect(svg).toMatch(/<svg[^>]*viewBox="-?\d+(\.\d+)?\s+-?\d+(\.\d+)?\s+\d+\s+\d+"/);
    expect(svg).toContain('<polygon');
  });

  it('leaves non-?optical urls alone', async () => {
    const css = `.icon { background-image: url('${iconPath('lucide/play')}'); }`;
    const { css: out } = await run(css);
    expect(out).toBe(css);
  });

  it('handles multiple url() in the same declaration', async () => {
    const css = `
      .icon {
        background-image:
          url('${iconPath('lucide/play')}?optical'),
          url('${iconPath('feather/camera')}?optical');
      }
    `;
    const { css: out } = await run(css);
    const dataUris = out.match(/data:image\/svg\+xml;utf8,[^"]+/g);
    expect(dataUris).toHaveLength(2);
    expect(decodeDataUri(`data:image/svg+xml;utf8,${dataUris![0]!.split(',')[1]!}`))
      .toContain('<polygon');
  });

  it('resolves alias prefixes', async () => {
    const css = `.icon { mask-image: url('@fixtures/icons/heroicons/bell-solid.svg?optical'); }`;
    const { css: out } = await run(css, {
      aliases: { '@fixtures': FIXTURES_ROOT.replace(/\/icons$/, '') },
    });
    const svg = decodeDataUri(pickDataUri(out));
    expect(svg).toContain('viewBox=');
  });

  it('rewrites mask-image too', async () => {
    const css = `.icon { mask-image: url('${iconPath('phosphor/triangle-fill')}?optical'); }`;
    const { css: out } = await run(css);
    expect(out).toContain('data:image/svg+xml;utf8,');
  });

  it('emits a PostCSS warning on unresolvable url, leaves value untouched', async () => {
    const css = `.icon { background-image: url('/no/such/file.svg?optical'); }`;
    const { css: out, warnings } = await run(css);
    expect(out).toContain('?optical');
    expect(warnings.some((w) => w.includes('failed to read'))).toBe(true);
  });

  it('resolves urls relative to the source CSS file', async () => {
    const css = `.icon { background-image: url('./play.svg?optical'); }`;
    const { css: out } = await run(css, undefined, iconPath('lucide/__styles.css'));
    const svg = decodeDataUri(pickDataUri(out));
    expect(svg).toContain('<polygon');
  });

  it('shifts the viewBox compared to the original SVG', async () => {
    const original = loadIcon('lucide/play');
    const css = `.icon { background-image: url('${iconPath('lucide/play')}?optical'); }`;
    const { css: out } = await run(css);
    const transformed = decodeDataUri(pickDataUri(out));

    const originalBox = original.match(/viewBox="([^"]+)"/)![1]!;
    const transformedBox = transformed.match(/viewBox="([^"]+)"/)![1]!;

    expect(transformedBox).not.toBe(originalBox);
  });

  it('reports a clip warning when the SVG content sits at the edge', async () => {
    const warnings: Array<{ code: string; location?: string }> = [];
    const css = `.icon { background-image: url('${iconPath('edge-cases/asymmetric-triangle')}?optical'); }`;
    await run(css, { onWarning: (w) => warnings.push(w) });
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain('OPTICAL_CLIP_DETECTED');
  });

  it('skips http(s) and data: urls without throwing', async () => {
    const css = `
      .a { background-image: url('https://example.com/x.svg?optical'); }
      .b { background-image: url('data:image/svg+xml;utf8,<svg/>?optical'); }
    `;
    const { css: out } = await run(css);
    expect(out).toContain('https://example.com/x.svg?optical');
    expect(out).toContain('data:image/svg+xml;utf8,<svg/>?optical');
  });
});
