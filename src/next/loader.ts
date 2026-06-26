/**
 * `optical-center/next/loader` — the per-file transform that powers the
 * Next.js adapter. Registered as a webpack `enforce: 'pre'` loader (and,
 * under Turbopack, a `turbopack.rules` entry) by `withOpticalCenter` in
 * `./index.ts`.
 *
 * It is a thin host for the existing engine, mirroring the `.jsx`/`.tsx`
 * and `.json` branches of `optical-center/vite`'s `transform(code, id)`:
 *
 *   - `.jsx` / `.tsx`  → run the Babel plugin ONLY (no React/TS transform),
 *                        so the inline `<svg optical-center>` viewBox is
 *                        rewritten while the JSX is left intact for Next's
 *                        SWC pass to compile afterwards. Running as a
 *                        `pre`-loader is what wins the same race the Vite
 *                        plugin wins with `enforce: 'pre'`.
 *   - `.json`          → recognise Iconify collections / single-icon
 *                        modules by shape and bake the optical shift into
 *                        the data before Next turns it into a JS module.
 *
 * Why a loader and not a Babel config: a project-level `.babelrc` would opt
 * the whole app out of SWC (and therefore React Compiler). A scoped loader
 * transforms one file at a time and hands the result back to SWC, so the
 * rest of the toolchain is untouched.
 *
 * Options crossing the Turbopack boundary must be JSON-serialisable, so the
 * function-valued Babel options (`onWarning`, `iconPackages`) are not
 * forwarded here — the Babel plugin falls back to its console.warn shim.
 */

import * as babel from '@babel/core';

import opticalCenterBabel from '../babel/index.js';
import type { BabelPluginOptions } from '../babel/index.js';
import { classifyIconData, jsonHeadMentionsIcon } from '../detect/icon-shape.js';
import { correctCollection, correctSingleIcon } from '../corrector/iconify.js';

/**
 * Hard ceiling on a `.json` module the icon-data pass will parse. Matches
 * the Vite plugin's `MAX_SET_BYTES` — beyond this we skip without parsing
 * so a multi-megabyte emoji set can't stall the build.
 */
const MAX_SET_BYTES = 8_000_000;

/**
 * Loader options. Every field is JSON-serialisable so the same object can be
 * passed to a Turbopack rule (which forbids functions / class instances).
 */
export interface NextLoaderOptions {
  /** Stamp `data-optical-*` breadcrumb attributes. Defaults to `false`. */
  readonly emitMetadata?: boolean;
  /** Upper bound on serialised JSX size before the Babel pass bails. */
  readonly maxInputBytes?: number;
  /** Override the shared on-disk cache directory. */
  readonly cacheDir?: string;
  /** Disable the per-plugin sync cache. */
  readonly disableCache?: boolean;
}

/**
 * Minimal structural type for the bits of the webpack/Turbopack loader
 * context this loader touches — avoids a hard dependency on `webpack` types.
 */
interface LoaderContext {
  readonly resourcePath: string;
  readonly sourceMap?: boolean;
  getOptions?: () => NextLoaderOptions | undefined;
  async: () => (
    err: Error | null,
    content?: string,
    map?: unknown,
  ) => void;
}

export default function opticalCenterLoader(
  this: LoaderContext,
  source: string,
): void {
  const callback = this.async();
  const id = this.resourcePath;
  const options = this.getOptions?.() ?? {};

  // `.json` icon-data → geometry rewrite (Iconify collections + singles).
  if (/\.json$/.test(id)) {
    transformIconData(source)
      .then((next) => callback(null, next ?? source))
      .catch((err) => callback(err as Error));
    return;
  }

  // `.jsx` / `.tsx` → Babel directive pass, JSX preserved for SWC.
  // Build with conditional spreads so an unset option is *absent*, not
  // explicitly `undefined` (the engine compiles with exactOptionalPropertyTypes).
  const merged: BabelPluginOptions = {
    emitMetadata: options.emitMetadata === true,
    ...(options.maxInputBytes !== undefined ? { maxInputBytes: options.maxInputBytes } : {}),
    ...(options.cacheDir !== undefined ? { cacheDir: options.cacheDir } : {}),
    ...(options.disableCache !== undefined ? { disableCache: options.disableCache } : {}),
  };
  babel
    .transformAsync(source, {
      filename: id,
      plugins: [[opticalCenterBabel, merged]],
      parserOpts: {
        plugins: id.endsWith('.tsx') ? ['jsx', 'typescript'] : ['jsx'],
        sourceType: 'module',
      },
      babelrc: false,
      configFile: false,
      sourceMaps: this.sourceMap ?? false,
    })
    .then((result) => {
      if (!result?.code) {
        callback(null, source);
        return;
      }
      callback(null, result.code, result.map ?? undefined);
    })
    .catch((err) => callback(err as Error));
}

/**
 * Recognise and correct an Iconify collection / single-icon `.json` module
 * in place. Returns the rewritten JSON string, or `null` to leave the source
 * untouched. Mirrors the Vite plugin's `transformIconData`.
 */
async function transformIconData(code: string): Promise<string | null> {
  if (Buffer.byteLength(code, 'utf8') > MAX_SET_BYTES) return null;
  if (!jsonHeadMentionsIcon(code)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(code);
  } catch {
    return null;
  }

  const kind = classifyIconData(parsed);
  if (kind === 'collection') {
    await correctCollection(parsed as Record<string, unknown>);
    return JSON.stringify(parsed);
  }
  if (kind === 'single') {
    await correctSingleIcon(parsed as Record<string, unknown>);
    return JSON.stringify(parsed);
  }
  return null;
}
