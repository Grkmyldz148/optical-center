import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

process.env['OPTICAL_CACHE_DIR'] = mkdtempSync(join(tmpdir(), 'oc-vite-icondata-'));

import opticalCenterVite from '../../src/vite/index.js';

interface TransformShape {
  transform?: (
    code: string,
    id: string,
  ) => Promise<{ code: string; map: unknown } | null> | { code: string } | null;
}

function transformOf(plugin: ReturnType<typeof opticalCenterVite>) {
  const t = (plugin as unknown as TransformShape).transform;
  if (typeof t !== 'function') throw new Error('transform is not a function');
  return (code: string, id: string) => t(code, id);
}

const PATH = '<path d="M8 5v14l11-7z"/>';
const COLLECTION = JSON.stringify({
  prefix: 'demo',
  width: 24,
  height: 24,
  icons: { play: { body: PATH }, stop: { body: '<rect x="6" y="6" width="12" height="12"/>' } },
});

describe('icon-data interception (transform level)', () => {
  it('body-wraps icons inside a recognised collection .json', async () => {
    const transform = transformOf(opticalCenterVite());
    const out = await transform(COLLECTION, '/proj/node_modules/@iconify/json/json/demo.json');
    expect(out).not.toBeNull();
    const parsed = JSON.parse((out as { code: string }).code);
    expect(parsed.icons.play.body).toContain('<g transform="translate(');
    // Original path data preserved inside the wrapper.
    expect(parsed.icons.play.body).toContain('M8 5v14l11-7z');
    // Idempotency sentinel stamped.
    expect(typeof parsed._opticalCenter).toBe('string');
  });

  it('rewrites a single-icon module .json', async () => {
    const transform = transformOf(opticalCenterVite());
    const single = JSON.stringify({ body: PATH, width: 24, height: 24 });
    const out = await transform(single, '/proj/node_modules/@iconify/icons-demo/play.json');
    expect(out).not.toBeNull();
    const parsed = JSON.parse((out as { code: string }).code);
    expect(parsed.body).toContain('<g transform="translate(');
  });

  it('passes non-icon JSON through untouched (returns null)', async () => {
    const transform = transformOf(opticalCenterVite());
    const tsconfig = JSON.stringify({ compilerOptions: { strict: true } });
    expect(await transform(tsconfig, '/proj/tsconfig.json')).toBeNull();
    const pkg = JSON.stringify({ name: 'pkg', version: '1.0.0' });
    expect(await transform(pkg, '/proj/package.json')).toBeNull();
  });

  it('honours the ?optical=off opt-out query', async () => {
    const transform = transformOf(opticalCenterVite());
    const out = await transform(COLLECTION, '/proj/icons/demo.json?optical=off');
    expect(out).toBeNull();
  });

  it('can be disabled entirely with iconData: false', async () => {
    const transform = transformOf(opticalCenterVite({ iconData: false }));
    const out = await transform(COLLECTION, '/proj/node_modules/x/demo.json');
    expect(out).toBeNull();
  });

  it('respects an iconData.exclude pattern', async () => {
    const transform = transformOf(
      opticalCenterVite({ iconData: { exclude: ['/brand/'] } }),
    );
    expect(await transform(COLLECTION, '/proj/brand/logos.json')).toBeNull();
    // A non-excluded path still gets corrected.
    expect(await transform(COLLECTION, '/proj/icons/demo.json')).not.toBeNull();
  });

  it('leaves .jsx/.tsx to the Babel path (no JSON handling)', async () => {
    const transform = transformOf(opticalCenterVite());
    // A .tsx with no optical-center markers → Babel returns code unchanged
    // or null; either way it is NOT treated as icon JSON.
    const out = await transform(`export const x = 1;`, '/proj/src/App.tsx');
    // No icon-data wrapping happened.
    if (out) expect((out as { code: string }).code).not.toContain('_opticalCenter');
  });
});
