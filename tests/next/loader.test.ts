import { describe, expect, it } from 'vitest';

import opticalCenterLoader from '../../src/next/loader.js';
import type { NextLoaderOptions } from '../../src/next/loader.js';

/**
 * Drive the loader the way webpack/Turbopack would: call it with a `this`
 * that exposes `resourcePath`, `getOptions`, and an async `callback`. The
 * loader is callback-based, so wrap it in a promise for assertions.
 */
function runLoader(
  source: string,
  resourcePath: string,
  options: NextLoaderOptions = {},
): Promise<{ code?: string; map?: unknown }> {
  return new Promise((resolve, reject) => {
    const ctx = {
      resourcePath,
      sourceMap: false,
      getOptions: () => options,
      async:
        () =>
        (err: Error | null, content?: string, map?: unknown): void => {
          if (err) reject(err);
          else resolve({ code: content, map });
        },
    };
    opticalCenterLoader.call(ctx as never, source);
  });
}

const PLAY_TSX =
  'const X = () => <svg opticalCenter viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;';

describe('next loader — JSX/TSX', () => {
  it('rewrites an inline <svg opticalCenter> and strips the marker', async () => {
    const out = await runLoader(PLAY_TSX, '/x/MyIcon.tsx');
    expect(out.code).toContain('data-optical-center=""');
    expect(out.code).not.toContain('opticalCenter');
  });

  it('emits breadcrumb metadata only when emitMetadata is set', async () => {
    const bare = await runLoader(PLAY_TSX, '/x/MyIcon.tsx');
    expect(bare.code).not.toContain('data-optical-original-viewbox');

    const withMeta = await runLoader(PLAY_TSX, '/x/MyIcon.tsx', {
      emitMetadata: true,
    });
    expect(withMeta.code).toContain('data-optical-original-viewbox');
  });

  it('leaves JSX without the marker untouched (still valid output)', async () => {
    const src = 'const X = () => <div>hi</div>;';
    const out = await runLoader(src, '/x/Plain.tsx');
    expect(out.code).toContain('<div>hi</div>');
    expect(out.code).not.toContain('data-optical-center');
  });
});

describe('next loader — icon-data JSON', () => {
  it('bakes the optical shift into an Iconify collection', async () => {
    const collection = JSON.stringify({
      prefix: 'demo',
      icons: {
        play: { body: '<path d="M8 5v14l11-7z"/>' },
      },
      width: 24,
      height: 24,
    });
    const out = await runLoader(collection, '/n/@iconify/json/json/demo.json');
    const parsed = JSON.parse(out.code as string);
    // The corrector body-wraps shifted icons in a translate group and stamps
    // a sentinel so re-runs are no-ops.
    expect(parsed._opticalCenter).toBeTruthy();
    expect(parsed.icons.play.body).toContain('translate');
  });

  it('passes through unrelated JSON unchanged', async () => {
    const tsconfig = JSON.stringify({ compilerOptions: { strict: true } });
    const out = await runLoader(tsconfig, '/x/tsconfig.json');
    expect(out.code).toBe(tsconfig);
  });
});
