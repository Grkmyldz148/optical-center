/**
 * `optical-center/vite` — orchestrator that runs `optical-center: auto`
 * through every build-time surface Vite owns, with one plugin entry.
 *
 * The directive surface has one user-facing API: the `optical-center`
 * declaration. It appears in two places:
 *
 *   - CSS:        `.foo { optical-center: auto; }`     (PostCSS plugin)
 *   - HTML/JSX:   `<svg optical-center="auto">…</svg>` (this plugin)
 *
 * On top of that, this plugin adds the **automatic icon-data layer**: it
 * recognises icon SVG that arrives as *data* (Iconify collections,
 * single-icon modules) by shape — no directive, no package allowlist — and
 * bakes the optical shift into the asset so the renderer paints it with
 * zero browser code. See `../detect/icon-shape` and `../corrector/iconify`.
 *
 * Hook map:
 *
 *   - enforce: 'pre'         Wins the race against esbuild's JSX transform
 *                            (so our visitor sees JSXElement, not a
 *                            CallExpression), AND against Vite's `vite:json`
 *                            transform (so we see raw JSON, not `export
 *                            default …`).
 *   - configResolved         Detect dev vs build → emitMetadata default.
 *   - transform(code, id)    `.jsx`/`.tsx` → Babel plugin;
 *                            `.json` icon data → geometry rewrite.
 *   - transformIndexHtml     Vanilla HTML `<svg optical-center>` blocks.
 *   - buildEnd               One-line summary of icons corrected.
 */

import * as babel from '@babel/core';
import type { Plugin } from 'vite';

import opticalCenterBabel from '../babel/index.js';
import type { BabelPluginOptions } from '../babel/index.js';
import { MAX_INPUT_BYTES } from '../core/constants.js';
import { sanitizeSvg } from '../node/sanitize.js';
import type { SanitizeOptions } from '../node/sanitize.js';
import type { WarningCode } from '../core/warnings.js';
import { classifyIconData, jsonHeadMentionsIcon } from '../detect/icon-shape.js';
import { correctCollection, correctSingleIcon } from '../corrector/iconify.js';

import { transformHtmlSvgs } from './transform-html-svg.js';

export interface VitePluginOptions {
  /**
   * Override the default `emitMetadata` selection. By default the plugin
   * opts in for `command === 'serve'` (dev) and out for `command === 'build'`
   * (production), keeping data-optical-original-viewbox / -offset out of
   * shipped HTML.
   */
  readonly emitMetadata?: boolean;
  /** Forwarded to the Babel plugin. */
  readonly babel?: BabelPluginOptions;
  /** Logger callback for every bail-out / clip warning. */
  readonly onWarning?: (warning: { code: WarningCode; location?: string }) => void;
  /**
   * Sanitize emitted SVG markup (drop `<script>`, on* handlers,
   * javascript: URIs, foreignObject). Default `true`. Pass an object to
   * narrow which categories are stripped, or `false` to opt out
   * entirely (only do this if the SVG sources are fully trusted).
   */
  readonly sanitize?: boolean | SanitizeOptions;
  /**
   * Filter which JSX/TSX module ids the Babel pass runs on. Modules
   * whose id matches at least one `include` pattern (and none of
   * `exclude`) are processed. By default every `.jsx`/`.tsx` file is
   * eligible. Either RegExp or substring patterns are accepted.
   */
  readonly include?: ReadonlyArray<RegExp | string>;
  /** Inverse of `include`. Wins on conflict. */
  readonly exclude?: ReadonlyArray<RegExp | string>;
  /**
   * Hard upper bound on the size (bytes) of an SVG payload before the
   * Babel pass gives up. Default `MAX_INPUT_BYTES` from constants.
   */
  readonly maxInputBytes?: number;
  /**
   * Control the automatic icon-data layer (Iconify collections + single-icon
   * modules detected by shape, corrected with no directive). Enabled by
   * default. Pass `false` to turn it off entirely, or an object to scope
   * which module ids are eligible. Per-import opt-out is also available via
   * the `?optical=off` query suffix.
   */
  readonly iconData?:
    | false
    | {
        readonly include?: ReadonlyArray<RegExp | string>;
        readonly exclude?: ReadonlyArray<RegExp | string>;
      };
}

const JSX_FILE = /\.[jt]sx(\?.*)?$/;
const JSON_FILE = /\.json(\?.*)?$/;
const OPTICAL_OFF = /[?&]optical=off\b/;

/**
 * Hard ceiling on a `.json` module the icon-data pass will parse. Beyond
 * this we skip without parsing — guards against the multi-megabyte
 * emoji/illustration sets (noto, fluent-emoji) that would stall a build.
 */
const MAX_SET_BYTES = 8_000_000;

export default function opticalCenterVite(
  options: VitePluginOptions = {},
): Plugin {
  let emitMetadata = options.emitMetadata;

  const onWarning = options.onWarning;
  const optionalOnWarning = onWarning ? { onWarning } : {};
  const sanitizeOption = options.sanitize ?? true;
  const sanitize = (svg: string): string => {
    if (sanitizeOption === false) return svg;
    if (sanitizeOption === true) return sanitizeSvg(svg);
    return sanitizeSvg(svg, sanitizeOption);
  };
  const maxInputBytes = options.maxInputBytes ?? MAX_INPUT_BYTES;
  const includes = options.include ?? null;
  const excludes = options.exclude ?? null;
  const isIncluded = (id: string): boolean => {
    if (excludes && excludes.some((p) => matchesPattern(p, id))) return false;
    if (!includes) return true;
    return includes.some((p) => matchesPattern(p, id));
  };

  // Automatic icon-data layer config.
  const iconDataOption = options.iconData;
  const iconDataEnabled = iconDataOption !== false;
  const iconDataConfig =
    typeof iconDataOption === 'object' && iconDataOption !== null
      ? iconDataOption
      : null;
  const iconDataIncludes = iconDataConfig?.include ?? null;
  const iconDataExcludes = iconDataConfig?.exclude ?? null;
  const isIconDataIncluded = (id: string): boolean => {
    if (OPTICAL_OFF.test(id)) return false;
    if (iconDataExcludes && iconDataExcludes.some((p) => matchesPattern(p, id))) return false;
    if (!iconDataIncludes) return true;
    return iconDataIncludes.some((p) => matchesPattern(p, id));
  };
  const iconStats = { collections: 0, singles: 0, icons: 0 };

  const transformIconData = async (
    code: string,
  ): Promise<{ code: string; map: null } | null> => {
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
      const stats = await correctCollection(parsed as Record<string, unknown>);
      iconStats.collections++;
      iconStats.icons += stats.corrected;
      return { code: JSON.stringify(parsed), map: null };
    }
    if (kind === 'single') {
      const changed = await correctSingleIcon(parsed as Record<string, unknown>);
      iconStats.singles++;
      if (changed) iconStats.icons++;
      return { code: JSON.stringify(parsed), map: null };
    }
    return null;
  };

  return {
    name: 'optical-center',
    enforce: 'pre',

    configResolved(config) {
      if (emitMetadata === undefined) {
        emitMetadata = config.command === 'serve';
      }
    },

    async transform(code, id) {
      // JSX/TSX → the Babel directive pass (inline <svg optical-center>,
      // container directives).
      if (JSX_FILE.test(id)) {
        if (!isIncluded(id)) return null;
        const babelOptions = options.babel;
        const onWarningForBabel = babelOptions?.onWarning ?? onWarning;
        const merged: BabelPluginOptions = {
          emitMetadata: babelOptions?.emitMetadata ?? emitMetadata === true,
          onWarning: onWarningForBabel ?? null,
          maxInputBytes: babelOptions?.maxInputBytes ?? maxInputBytes,
        };
        const result = await babel.transformAsync(code, {
          filename: id,
          plugins: [[opticalCenterBabel, merged]],
          parserOpts: {
            plugins: id.endsWith('.tsx') || id.endsWith('.tsx?')
              ? ['jsx', 'typescript']
              : ['jsx'],
            sourceType: 'module',
          },
          babelrc: false,
          configFile: false,
          sourceMaps: true,
        });
        if (!result?.code) return null;
        return { code: result.code, map: result.map ?? null };
      }

      // `.json` icon data → geometry rewrite, before vite:json turns it
      // into a JS module. Runs at enforce:'pre' so we see raw JSON.
      if (iconDataEnabled && JSON_FILE.test(id) && isIconDataIncluded(id)) {
        return transformIconData(code);
      }

      return null;
    },

    buildEnd() {
      if (iconStats.collections === 0 && iconStats.singles === 0) return;
      const parts: string[] = [`corrected ${iconStats.icons} icon(s)`];
      if (iconStats.collections > 0) {
        parts.push(`${iconStats.collections} collection(s)`);
      }
      if (iconStats.singles > 0) {
        parts.push(`${iconStats.singles} single module(s)`);
      }
      this.info?.(`optical-center: ${parts.join(', ')}`);
    },

    // transformIndexHtml uses `order: 'post'` so we see the HTML *after*
    // every other plugin has had a turn. That is critical when frameworks
    // (Astro, Marko, vite-plugin-svelte) inject their own SVGs late in
    // the build — running pre would miss them.
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const opts = optionalOnWarning;
        return transformHtmlSvgs(html, {
          emitMetadata: emitMetadata === true,
          sanitize,
          ...opts,
        });
      },
    },
  };
}

function matchesPattern(pattern: RegExp | string, id: string): boolean {
  return typeof pattern === 'string' ? id.includes(pattern) : pattern.test(id);
}
