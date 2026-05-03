/**
 * `optical-center/vite` — the orchestrator that gets every flavor of
 * SVG (JSX, asset import, raw HTML) through the build-time pipeline
 * with one plugin entry.
 *
 * Hook map (per ADR-3 + ADR-4):
 *
 *   - enforce: 'pre'         Wins the race against esbuild's JSX
 *                            transform; without this, our visitor would
 *                            see CallExpression where it expects
 *                            JSXElement.
 *   - config(_, env)         Detect dev vs build → emitMetadata default.
 *   - load(id)               `*.svg?optical` query → read file, run
 *                            pipeline, return the rewritten SVG as the
 *                            default export of a JS module.
 *   - transform(code, id)    `.jsx` / `.tsx` → run the Babel plugin.
 *   - transformIndexHtml     Vanilla HTML `<svg optical-center>` blocks.
 *   - handleHotUpdate        Invalidate ?optical assets on file change.
 */

import { readFile } from 'node:fs/promises';
import * as babel from '@babel/core';
import type { HmrContext, Plugin, ResolvedConfig } from 'vite';

import { applyTransformToSvg } from '../core/apply-to-svg.js';
import opticalCenterBabel from '../babel/index.js';
import type { BabelPluginOptions } from '../babel/index.js';
import { MAX_INPUT_BYTES } from '../core/constants.js';
import { transformViewBoxFromSvg } from '../node/transform-viewbox-from-svg.js';
import { sanitizeSvg } from '../node/sanitize.js';
import type { SanitizeOptions } from '../node/sanitize.js';
import type { WarningCode } from '../core/warnings.js';

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
   * plugin gives up. Applies to both ?optical asset imports and the
   * forwarded Babel pass. Default `MAX_INPUT_BYTES` from constants.
   */
  readonly maxInputBytes?: number;
}

const JSX_FILE = /\.[jt]sx(\?.*)?$/;
const SVG_OPTICAL_FILE = /\.svg\?optical(?:&|$)/;
const SVG_OPTICAL_FILE_WITH_PATH = /^([^?]+)\.svg\?optical(?:&|$)/;

export default function opticalCenterVite(
  options: VitePluginOptions = {},
): Plugin {
  let emitMetadata = options.emitMetadata;
  let resolvedConfig: ResolvedConfig | undefined;

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

  return {
    name: 'optical-center',
    enforce: 'pre',

    configResolved(config) {
      resolvedConfig = config;
      if (emitMetadata === undefined) {
        emitMetadata = config.command === 'serve';
      }
    },

    async load(id) {
      const match = id.match(SVG_OPTICAL_FILE_WITH_PATH);
      if (!match) return null;
      const filePath = `${match[1]}.svg`;
      let svg: string;
      try {
        svg = await readFile(filePath, 'utf8');
      } catch {
        return null;
      }
      if (svg.length > maxInputBytes) {
        onWarning?.({ code: 'OPTICAL_RASTERIZE_FAILED', location: filePath });
        return `export default ${JSON.stringify(svg)};`;
      }
      // ?optical is an explicit opt-in by the importer — transform
      // unconditionally, no marker required.
      const sanitized = sanitize(svg);
      try {
        const result = transformViewBoxFromSvg(sanitized, {
          emitMetadata: emitMetadata === true,
        });
        const next = applyTransformToSvg(sanitized, {
          viewBox: result.viewBox,
          breadcrumb: result.breadcrumb,
        });
        if (result.clipDetected) {
          onWarning?.({ code: 'OPTICAL_CLIP_DETECTED', location: filePath });
        }
        return `export default ${JSON.stringify(next)};`;
      } catch {
        onWarning?.({ code: 'OPTICAL_RASTERIZE_FAILED', location: filePath });
        return `export default ${JSON.stringify(sanitized)};`;
      }
    },

    async transform(code, id) {
      if (!JSX_FILE.test(id)) return null;
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
    },

    transformIndexHtml(html) {
      const opts = optionalOnWarning;
      return transformHtmlSvgs(html, {
        emitMetadata: emitMetadata === true,
        sanitize,
        ...opts,
      });
    },

    handleHotUpdate(ctx: HmrContext) {
      // Invalidate `?optical` SVG modules when the source file changes.
      if (!ctx.file.toLowerCase().endsWith('.svg')) return;
      const matchingModules = Array.from(ctx.server.moduleGraph.urlToModuleMap.keys())
        .filter((url) => url.startsWith(ctx.file) && SVG_OPTICAL_FILE.test(url));
      if (matchingModules.length === 0) return;
      return ctx.modules.concat(
        matchingModules.flatMap((url) => {
          const mod = ctx.server.moduleGraph.urlToModuleMap.get(url);
          return mod ? [mod] : [];
        }),
      );
    },
  };
}

export type { ResolvedConfig };

function matchesPattern(pattern: RegExp | string, id: string): boolean {
  return typeof pattern === 'string' ? id.includes(pattern) : pattern.test(id);
}
