/**
 * Real Vite build of an Iconify-style JSON import, to prove the icon-data
 * interceptor runs before `vite:json` through actual Vite — not just the
 * transform-shape unit tests. The corrected (body-wrapped) geometry must
 * end up in the emitted bundle.
 */

import { mkdtemp, mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from 'vite';
import { describe, expect, it } from 'vitest';

import opticalCenter from '../../src/vite/index.js';

const COLLECTION = JSON.stringify({
  prefix: 'demo',
  width: 24,
  height: 24,
  icons: { play: { body: '<path d="M8 5v14l11-7z"/>' } },
});

async function readAllJs(dir: string): Promise<string> {
  const out: string[] = [];
  const walk = async (d: string): Promise<void> => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.js')) out.push(await readFile(full, 'utf8'));
    }
  };
  await walk(dir);
  return out.join('\n');
}

describe('Vite build integration — icon data', () => {
  it('body-wraps an imported Iconify JSON set in the emitted bundle', async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'oc-icondata-build-')));
    process.env['OPTICAL_CACHE_DIR'] = join(dir, '.cache');
    await mkdir(join(dir, 'src'), { recursive: true });

    await writeFile(join(dir, 'src', 'icons.json'), COLLECTION);
    await writeFile(
      join(dir, 'src', 'main.js'),
      `import set from './icons.json';
const el = document.createElement('span');
// Reference the body so Rollup can't tree-shake it away.
el.setAttribute('data-body', set.icons.play.body);
document.body.appendChild(el);
`,
    );
    await writeFile(
      join(dir, 'index.html'),
      `<!doctype html><html><body><script type="module" src="/src/main.js"></script></body></html>`,
    );

    await build({
      root: dir,
      logLevel: 'error',
      plugins: [opticalCenter()],
      build: { write: true },
    });

    const js = await readAllJs(join(dir, 'dist'));
    expect(js).toContain('M8 5v14l11-7z'); // original path preserved
    expect(js).toContain('translate('); // optical shift baked in as a body-wrap
  }, 60_000);
});
