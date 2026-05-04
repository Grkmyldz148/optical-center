/**
 * `optical-center/postcss` — bundler-agnostic build-time path for any
 * `url('…svg?optical')` reference that lives in CSS. Mirrors the
 * `?optical` contract of the Vite plugin so the same authoring style
 * works in webpack/Tailwind/PostCSS-CLI/Next without a Vite dep.
 *
 * What it does on every declaration value containing `?optical`:
 *   1. Resolve the URL against aliases → CSS file directory → root.
 *   2. Read the SVG from disk and sanitize.
 *   3. Run the rasterize → optical-center → viewBox-rewrite pipeline.
 *   4. Inline the rewritten SVG as a `url("data:image/svg+xml,…")` URI.
 *
 * Inline data URIs (vs. emitting a sibling file) keep the plugin pure:
 * no asset hooks, no graph awareness, works in any PostCSS host.
 */

import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

import type { Declaration, PluginCreator, Result, Root } from 'postcss';

import { applyTransformToSvg } from '../core/apply-to-svg.js';
import { MAX_INPUT_BYTES } from '../core/constants.js';
import type { WarningCode } from '../core/warnings.js';
import { sanitizeSvg } from '../node/sanitize.js';
import type { SanitizeOptions } from '../node/sanitize.js';
import { transformViewBoxFromSvg } from '../node/transform-viewbox-from-svg.js';

export interface PostcssPluginOptions {
  /**
   * Alias prefixes that resolve to absolute filesystem paths. Mirrors
   * the Vite `resolve.alias` convention so a CSS that writes
   * `url('@fixtures/icons/play.svg?optical')` keeps working under
   * postcss-cli/webpack/Tailwind without relying on Vite.
   */
  readonly aliases?: Readonly<Record<string, string>>;
  /**
   * Fallback resolution root used when a URL is relative but the CSS
   * source has no `from` (e.g. inline strings passed to PostCSS).
   * Defaults to `process.cwd()`.
   */
  readonly root?: string;
  /** Forwarded to the core viewBox transform. Default `false`. */
  readonly emitMetadata?: boolean;
  /** Strip `<script>` / `on*` / `javascript:` from the SVG. Default `true`. */
  readonly sanitize?: boolean | SanitizeOptions;
  /** Receives every bail-out / clip warning. */
  readonly onWarning?: (warning: { code: WarningCode; location?: string }) => void;
  /** Hard upper bound on the source SVG size in bytes. */
  readonly maxInputBytes?: number;
}

const URL_PATTERN =
  /url\(\s*(['"]?)([^'")]+?\.svg\?optical(?:&[^'")]*)?)\1\s*\)/gi;

const PLUGIN_NAME = 'optical-center';

const opticalCenterPostcss: PluginCreator<PostcssPluginOptions> = (
  options = {},
) => {
  const aliases = options.aliases ?? {};
  const root = options.root;
  const emitMetadata = options.emitMetadata === true;
  const sanitizeOption = options.sanitize ?? true;
  const onWarning = options.onWarning;
  const maxInputBytes = options.maxInputBytes ?? MAX_INPUT_BYTES;

  const sanitize = (svg: string): string => {
    if (sanitizeOption === false) return svg;
    if (sanitizeOption === true) return sanitizeSvg(svg);
    return sanitizeSvg(svg, sanitizeOption);
  };

  const aliasEntries = Object.entries(aliases).sort(
    ([a], [b]) => b.length - a.length,
  );

  return {
    postcssPlugin: PLUGIN_NAME,
    async Once(cssRoot: Root, helpers: { result: Result }) {
      const cssFrom = cssRoot.source?.input.from;
      const baseDir = cssFrom
        ? dirname(cssFrom)
        : root ?? process.cwd();

      const tasks: Array<Promise<void>> = [];
      cssRoot.walkDecls((decl) => {
        if (!decl.value.includes('?optical')) return;
        tasks.push(rewriteDeclaration(decl, baseDir, helpers.result));
      });
      await Promise.all(tasks);
    },
  };

  async function rewriteDeclaration(
    decl: Declaration,
    baseDir: string,
    result: Result,
  ): Promise<void> {
    const original = decl.value;
    const matches = collectMatches(original);
    if (matches.length === 0) return;

    let next = original;
    for (const { full, rawUrl } of matches) {
      const dataUri = await loadAndTransform(rawUrl, baseDir, result, decl);
      if (dataUri === null) continue;
      next = next.split(full).join(`url("${dataUri}")`);
    }
    if (next !== original) decl.value = next;
  }

  async function loadAndTransform(
    rawUrl: string,
    baseDir: string,
    result: Result,
    decl: Declaration,
  ): Promise<string | null> {
    const cleanUrl = rawUrl.replace(/\?optical(&.*)?$/, '');
    const filePath = resolveUrl(cleanUrl, baseDir);
    if (!filePath) {
      result.warn(`unresolvable url: ${rawUrl}`, { node: decl });
      return null;
    }

    let svg: string;
    try {
      svg = await readFile(filePath, 'utf8');
    } catch (err) {
      result.warn(`failed to read ${filePath}: ${(err as Error).message}`, {
        node: decl,
      });
      onWarning?.({ code: 'OPTICAL_RASTERIZE_FAILED', location: filePath });
      return null;
    }

    if (svg.length > maxInputBytes) {
      onWarning?.({ code: 'OPTICAL_RASTERIZE_FAILED', location: filePath });
      return svgToDataUri(svg);
    }

    const sanitized = sanitize(svg);
    try {
      const transform = transformViewBoxFromSvg(sanitized, { emitMetadata });
      const rewritten = applyTransformToSvg(sanitized, {
        viewBox: transform.viewBox,
        breadcrumb: transform.breadcrumb,
      });
      if (transform.clipDetected) {
        onWarning?.({ code: 'OPTICAL_CLIP_DETECTED', location: filePath });
      }
      return svgToDataUri(rewritten);
    } catch (err) {
      result.warn(
        `optical-center rewrite failed for ${filePath}: ${(err as Error).message}`,
        { node: decl },
      );
      onWarning?.({ code: 'OPTICAL_RASTERIZE_FAILED', location: filePath });
      return svgToDataUri(sanitized);
    }
  }

  function resolveUrl(rawUrl: string, baseDir: string): string | null {
    if (rawUrl.startsWith('data:') || /^https?:\/\//.test(rawUrl)) return null;

    for (const [prefix, target] of aliasEntries) {
      if (rawUrl === prefix || rawUrl.startsWith(`${prefix}/`)) {
        const rest = rawUrl.slice(prefix.length).replace(/^\/+/, '');
        return resolve(target, rest);
      }
    }

    if (isAbsolute(rawUrl)) return rawUrl;
    return resolve(baseDir, rawUrl);
  }
};

opticalCenterPostcss.postcss = true;

export default opticalCenterPostcss;

interface UrlMatch {
  readonly full: string;
  readonly rawUrl: string;
}

function collectMatches(value: string): ReadonlyArray<UrlMatch> {
  const matches: UrlMatch[] = [];
  URL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_PATTERN.exec(value)) !== null) {
    matches.push({ full: match[0], rawUrl: match[2]! });
  }
  return matches;
}

/**
 * URI-encode the SVG for inlining as a `data:` value. Quote the result
 * with `"` in CSS — single quotes can occur inside attributes
 * (e.g. `font-family='…'`).
 */
function svgToDataUri(svg: string): string {
  const collapsed = svg.replace(/\s+/g, ' ').trim();
  const encoded = collapsed
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/"/g, '%22')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/\{/g, '%7B')
    .replace(/\}/g, '%7D');
  return `data:image/svg+xml;utf8,${encoded}`;
}
