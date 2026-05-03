/**
 * Spins up an actual Vite build in a tmpdir and inspects the output to
 * make sure the optical-center plugin wires through real Vite — not
 * just the mock plugin shape we exercise elsewhere. Skipped on CI by
 * default if Vite isn't installable; passes on a normal dev machine.
 */

import { mkdtemp, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

import opticalCenter from '../../src/vite/index.js';

const PLAY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

describe('Vite build integration', () => {
  it('rewrites <svg optical-center> in index.html during a real build', async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'oc-vite-build-')));
    await writeFile(
      join(dir, 'index.html'),
      `<!doctype html><html><body>${PLAY_SVG.replace('<svg', '<svg optical-center')}</body></html>`,
    );

    await build({
      root: dir,
      logLevel: 'error',
      plugins: [opticalCenter()],
      build: { write: true },
    });

    const out = await readFile(join(dir, 'dist', 'index.html'), 'utf8');
    expect(out).toContain('data-optical-center=""');
    expect(out).not.toMatch(/\soptical-center\b/);
    expect(out).toMatch(/viewBox="-?\d+\.?\d*\s+-?\d+\.?\d*\s+24\s+24"/);
  }, 30_000);

  it('transforms a ?optical asset import in a built bundle', async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'oc-vite-build-')));
    const srcDir = join(dir, 'src');
    await mkdir(srcDir, { recursive: true });
    await writeFile(join(srcDir, 'play.svg'), PLAY_SVG);
    await writeFile(
      join(srcDir, 'main.js'),
      `import svg from './play.svg?optical';\nconsole.log(svg);\nexport default svg;`,
    );
    await writeFile(
      join(dir, 'index.html'),
      `<!doctype html><html><body><script type="module" src="/src/main.js"></script></body></html>`,
    );

    await build({
      root: dir,
      logLevel: 'error',
      plugins: [opticalCenter()],
      build: {
        write: true,
        rollupOptions: { input: join(dir, 'index.html') },
      },
    });

    const html = await readFile(join(dir, 'dist', 'index.html'), 'utf8');
    const jsMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
    expect(jsMatch).not.toBeNull();
    if (!jsMatch) return;
    const js = await readFile(join(dir, 'dist', jsMatch[1]!.slice(1)), 'utf8');
    expect(js).toContain('data-optical-center');
    // The viewBox is rewritten — minifiers spit it back with various
    // quote styles, so we look for the negative-x marker (the play
    // triangle's correction is always negative) instead of a literal
    // string match.
    expect(js).toMatch(/viewBox[^>]*-\d/);
    expect(js).not.toMatch(/viewBox\\?["']0 0 24 24/);
  }, 30_000);
});
