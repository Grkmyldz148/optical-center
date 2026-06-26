/**
 * `optical-center/next` — Next.js adapter.
 *
 * Wrap your config:
 *
 *   // next.config.ts
 *   import withOpticalCenter from 'optical-center/next';
 *   export default withOpticalCenter({
 *     // …your usual Next config
 *   });
 *
 * Then mark inline SVGs the same way as every other adapter:
 *
 *   <svg optical-center="auto" viewBox="0 0 24 24">
 *     <path d="M8 5v14l11-7z" />
 *   </svg>
 *
 * The adapter registers a single transform (`./loader`) on two surfaces so it
 * works under both of Next's bundlers:
 *
 *   - Webpack   — a `enforce: 'pre'` rule on `.jsx`/`.tsx` (runs before the
 *                 SWC loader, so the directive is applied while the JSX is
 *                 still JSX) plus a scoped rule on icon-package `.json`.
 *   - Turbopack — equivalent `turbopack.rules` entries for `*.jsx`/`*.tsx`.
 *
 * Because the loader only rewrites SVG markup and hands the file back as
 * JSX, SWC and the React Compiler keep doing the actual compilation — unlike
 * a project-level `.babelrc`, which would opt the whole app out of SWC.
 *
 * NOTE: the loader depends on `@babel/core`, which Next does not install by
 * default. Add it as a dev dependency: `npm i -D @babel/core`.
 */

import { createRequire } from 'node:module';

import type { NextLoaderOptions } from './loader.js';

const require = createRequire(import.meta.url);

/** Module specifier the bundlers resolve the loader from. */
const LOADER = 'optical-center/next/loader';

/**
 * `node_modules` path fragments that hold renderable icon data. The webpack
 * `.json` rule is scoped to these so the loader never wakes up for an app's
 * `tsconfig.json`, locale bundles, or build manifests.
 */
const ICON_DATA_DEFAULT_INCLUDE: readonly string[] = [
  'node_modules/@iconify/json',
  'node_modules/@iconify-json',
  'node_modules/@iconify/icons-',
  'node_modules/lucide-static',
];

export interface NextAdapterOptions {
  /**
   * Stamp `data-optical-original-viewbox` / `data-optical-offset` breadcrumb
   * attributes for DevTools inspection. Defaults to `true` in development and
   * `false` in production (keeps shipped HTML lean), mirroring the Vite
   * plugin's dev/build split.
   */
  readonly emitMetadata?: boolean;
  /** Upper bound on serialised SVG size before the Babel pass bails. */
  readonly maxInputBytes?: number;
  /** Override the shared on-disk cache directory. */
  readonly cacheDir?: string;
  /** Disable the per-plugin sync cache (useful in CI / tests). */
  readonly disableCache?: boolean;
  /**
   * Automatic icon-data layer (Iconify collections + single-icon modules,
   * corrected with no directive). Enabled by default and scoped to the icon
   * packages above. Pass `false` to turn it off, or an object with `include`
   * (`node_modules` path fragments) to broaden the scope.
   *
   * Webpack only by default — see `turbopackIconData`.
   */
  readonly iconData?: false | { readonly include?: readonly string[] };
  /**
   * Opt the icon-data `.json` rewrite into Turbopack too. Off by default: a
   * Turbopack `*.json` rule matches every JSON the graph touches (build
   * manifests included), so it is gated behind an explicit flag until that
   * surface is proven on your project. The Webpack path is always scoped and
   * safe.
   */
  readonly turbopackIconData?: boolean;
}

export default function withOpticalCenter(
  nextConfig: any = {},
  options: NextAdapterOptions = {},
): any {
  const dev = process.env['NODE_ENV'] !== 'production';
  const emitMetadata = options.emitMetadata ?? dev;

  // Only JSON-serialisable fields cross into a Turbopack rule. Built with
  // conditional spreads so unset options stay absent under
  // exactOptionalPropertyTypes.
  const loaderOptions: NextLoaderOptions = {
    emitMetadata,
    ...(options.maxInputBytes !== undefined ? { maxInputBytes: options.maxInputBytes } : {}),
    ...(options.cacheDir !== undefined ? { cacheDir: options.cacheDir } : {}),
    ...(options.disableCache !== undefined ? { disableCache: options.disableCache } : {}),
  };

  const iconDataEnabled = options.iconData !== false;
  const iconInclude = iconDataEnabled
    ? options.iconData && 'include' in options.iconData && options.iconData.include
      ? options.iconData.include
      : ICON_DATA_DEFAULT_INCLUDE
    : [];

  const existingWebpack = nextConfig.webpack;

  return {
    ...nextConfig,

    webpack(config: any, ctx: any) {
      const loaderResolved = require.resolve(LOADER);

      config.module ??= {};
      config.module.rules ??= [];

      config.module.rules.push({
        test: /\.[jt]sx$/,
        exclude: /node_modules/,
        enforce: 'pre',
        use: [{ loader: loaderResolved, options: loaderOptions }],
      });

      if (iconInclude.length > 0) {
        config.module.rules.push({
          test: /\.json$/,
          enforce: 'pre',
          include: (resource: string) =>
            iconInclude.some((fragment) => resource.includes(fragment)),
          use: [{ loader: loaderResolved, options: loaderOptions }],
        });
      }

      return typeof existingWebpack === 'function'
        ? existingWebpack(config, ctx)
        : config;
    },

    turbopack: {
      ...nextConfig.turbopack,
      rules: {
        ...nextConfig.turbopack?.rules,
        // `as` is intentionally omitted: the loader transforms in place and
        // re-emits the same module type, so Turbopack continues with its
        // built-in .tsx/.jsx/.json handling. Setting `as: '*.tsx'` would
        // re-append the extension (page.tsx → page.tsx.tsx).
        '*.tsx': {
          loaders: [{ loader: LOADER, options: loaderOptions }],
        },
        '*.jsx': {
          loaders: [{ loader: LOADER, options: loaderOptions }],
        },
        ...(iconDataEnabled && options.turbopackIconData === true
          ? {
              '*.json': {
                loaders: [{ loader: LOADER, options: loaderOptions }],
              },
            }
          : {}),
      },
    },
  };
}
