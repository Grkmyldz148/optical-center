/**
 * Spins up an actual Vite build in a tmpdir and inspects the output to
 * make sure the optical-center plugin wires through real Vite — not
 * just the mock plugin shape we exercise elsewhere. Skipped on CI by
 * default if Vite isn't installable; passes on a normal dev machine.
 */

import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
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
});
