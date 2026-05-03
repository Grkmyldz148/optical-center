import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import opticalCenterVite from '../../src/vite/index.js';
import { transformHtmlSvgs } from '../../src/vite/transform-html-svg.js';

interface VitePluginShape {
  name: string;
  enforce?: 'pre' | 'post';
  configResolved?: (cfg: { command: 'serve' | 'build' }) => void;
  load?: (id: string) => Promise<string | null>;
  transform?: (
    code: string,
    id: string,
  ) => Promise<{ code: string; map: unknown } | null>;
  transformIndexHtml?: (html: string) => string | Promise<string>;
}

function asVitePlugin(plugin: ReturnType<typeof opticalCenterVite>): VitePluginShape {
  return plugin as unknown as VitePluginShape;
}

const PLAY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

describe('opticalCenterVite plugin shape', () => {
  it('exposes the expected hooks and metadata', () => {
    const plugin = asVitePlugin(opticalCenterVite());
    expect(plugin.name).toBe('optical-center');
    expect(plugin.enforce).toBe('pre');
    expect(typeof plugin.load).toBe('function');
    expect(typeof plugin.transform).toBe('function');
    expect(typeof plugin.transformIndexHtml).toBe('function');
  });

  it('defaults emitMetadata to true under serve and false under build', async () => {
    const serve = asVitePlugin(opticalCenterVite());
    serve.configResolved?.({ command: 'serve' });
    const html = `<html><body>${PLAY_SVG.replace('<svg', '<svg optical-center')}</body></html>`;
    const out = await Promise.resolve(serve.transformIndexHtml?.(html) ?? '');
    expect(out).toContain('data-optical-original-viewbox');

    const build = asVitePlugin(opticalCenterVite());
    build.configResolved?.({ command: 'build' });
    const buildOut = await Promise.resolve(
      build.transformIndexHtml?.(html) ?? '',
    );
    expect(buildOut).not.toContain('data-optical-original-viewbox');
    expect(buildOut).toContain('data-optical-center=""');
  });
});

describe('transformIndexHtml', () => {
  it('rewrites <svg optical-center> blocks', () => {
    const out = transformHtmlSvgs(
      `<html><body>${PLAY_SVG.replace('<svg', '<svg optical-center')}</body></html>`,
      { emitMetadata: false },
    );
    expect(out).toContain('data-optical-center=""');
    expect(out).not.toContain(' optical-center');
    expect(out).toMatch(/viewBox="-?\d+\.?\d*\s+-?\d+\.?\d*\s+24\s+24"/);
  });

  it('leaves <svg optical-center="false"> alone', () => {
    const html = `<svg optical-center="false" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    const out = transformHtmlSvgs(html, { emitMetadata: false });
    expect(out).toBe(html);
  });

  it('skips SVGs without the marker', () => {
    const out = transformHtmlSvgs(`<html>${PLAY_SVG}</html>`, {
      emitMetadata: false,
    });
    expect(out).not.toContain('data-optical-center');
  });

  it('strips dangerous content via the sanitize hook', async () => {
    const dirty =
      '<svg optical-center xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="hack()"><script>steal()</script><path d="M8 5v14l11-7z"/></svg>';
    const plugin = asVitePlugin(opticalCenterVite());
    plugin.configResolved?.({ command: 'build' });
    const out = await Promise.resolve(
      plugin.transformIndexHtml?.(`<html>${dirty}</html>`) ?? '',
    );
    expect(out).not.toContain('onload');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('steal()');
    expect(out).toContain('data-optical-center=""');
  });
});

describe('load() — ?optical SVG asset', () => {
  it('returns a JS module exporting the transformed SVG string', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oc-vite-'));
    const file = join(dir, 'play.svg');
    await writeFile(file, PLAY_SVG);

    const plugin = asVitePlugin(opticalCenterVite());
    plugin.configResolved?.({ command: 'build' });

    const result = await plugin.load?.(`${file}?optical`);
    expect(result).not.toBeNull();
    expect(result).toContain('export default ');
    expect(result).toContain('data-optical-center');
    expect(result).toContain('viewBox=\\"-');
  });

  it('returns null for non-?optical SVG ids', async () => {
    const plugin = asVitePlugin(opticalCenterVite());
    plugin.configResolved?.({ command: 'build' });
    expect(await plugin.load?.('/some/file.svg')).toBeNull();
    expect(await plugin.load?.('/other.tsx')).toBeNull();
  });
});

describe('transform() — JSX/TSX', () => {
  it('runs the Babel plugin on .tsx files', async () => {
    const plugin = asVitePlugin(opticalCenterVite());
    plugin.configResolved?.({ command: 'build' });
    const result = await plugin.transform?.(
      'const X = () => <svg opticalCenter viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
      '/x/MyIcon.tsx',
    );
    expect(result?.code).toContain('data-optical-center=""');
    expect(result?.code).not.toContain('opticalCenter');
  });

  it('skips files that are not jsx/tsx', async () => {
    const plugin = asVitePlugin(opticalCenterVite());
    plugin.configResolved?.({ command: 'build' });
    const result = await plugin.transform?.('export const x = 1;', '/x/foo.ts');
    expect(result).toBeNull();
  });

  it('honors include patterns', async () => {
    const plugin = asVitePlugin(opticalCenterVite({ include: [/icons\//] }));
    plugin.configResolved?.({ command: 'build' });
    const skipped = await plugin.transform?.(
      'const X = () => <svg opticalCenter viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
      '/components/MyIcon.tsx',
    );
    expect(skipped).toBeNull();

    const matched = await plugin.transform?.(
      'const X = () => <svg opticalCenter viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
      '/icons/MyIcon.tsx',
    );
    expect(matched?.code).toContain('data-optical-center=""');
  });

  it('honors exclude patterns (wins over include)', async () => {
    const plugin = asVitePlugin(
      opticalCenterVite({ include: [/icons\//], exclude: ['MyIcon'] }),
    );
    plugin.configResolved?.({ command: 'build' });
    const result = await plugin.transform?.(
      'const X = () => <svg opticalCenter viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
      '/icons/MyIcon.tsx',
    );
    expect(result).toBeNull();
  });
});
