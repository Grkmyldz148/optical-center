/**
 * `optical-center/postcss` — bundler-agnostic build-time CSS path. The
 * opt-in is a rule-level directive:
 *
 *   .icon {
 *     background-image: url('icons/play.svg');
 *     optical-center: auto;
 *   }
 *
 * When the plugin sees `optical-center: auto` (or `--optical-center: auto`,
 * for editors/linters that flag unknown properties), it walks every
 * other declaration in the same rule, runs every `url('…svg')` through
 * the rasterize → optical-center → viewBox-rewrite pipeline, and
 * inlines the rewritten SVG as a `data:image/svg+xml,…` URI. The
 * directive itself is stripped from the output.
 *
 * Works in any property: `background-image`, `mask-image`,
 * `border-image-source`, `content`, `cursor`, custom properties — if
 * a `url('*.svg')` lives in the rule, it gets corrected.
 */

import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

import type { Declaration, PluginCreator, Result, Root, Rule } from 'postcss';

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
   * `url('@fixtures/icons/play.svg')` keeps working under
   * postcss-cli/webpack/Tailwind without a Vite dep.
   */
  readonly aliases?: Readonly<Record<string, string>>;
  /**
   * Fallback resolution root used when a path is relative but the CSS
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

const DIRECTIVE_PROPS = new Set(['optical-center', '--optical-center']);

const URL_PATTERN =
  /url\(\s*(['"]?)([^'")]+?\.svg)\1\s*\)/gi;

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
      cssRoot.walkRules((rule) => {
        const directive = findDirective(rule);
        if (!directive) return;
        if (directive.value.trim() !== 'auto') {
          // Future-proofing: `optical-center: none` could opt a nested
          // rule out of an inherited setting. For now `auto` is the
          // only honored value — anything else is left as-is so it's
          // visible in the output if the author meant something.
          return;
        }
        directive.remove();
        tasks.push(processRule(rule, baseDir, helpers.result));
      });
      await Promise.all(tasks);
    },
  };

  async function processRule(
    rule: Rule,
    baseDir: string,
    result: Result,
  ): Promise<void> {
    const decls: Declaration[] = [];
    rule.walkDecls((decl) => {
      if (DIRECTIVE_PROPS.has(decl.prop)) return;
      // Cheap substring filter — `URL_PATTERN.test` would mutate the
      // shared regex's lastIndex (it has the /g flag) and break the
      // next call. The full match runs in rewriteDeclaration.
      if (!decl.value.includes('url(')) return;
      decls.push(decl);
    });

    await Promise.all(
      decls.map((decl) => rewriteDeclaration(decl, baseDir, result)),
    );
  }

  async function rewriteDeclaration(
    decl: Declaration,
    baseDir: string,
    result: Result,
  ): Promise<void> {
    const original = decl.value;
    const matches = collectUrls(original);
    if (matches.length === 0) return;

    let next = original;
    for (const { full, path } of matches) {
      const dataUri = await loadAndTransform(path, baseDir, result, decl);
      if (dataUri === null) continue;
      next = next.split(full).join(`url("${dataUri}")`);
    }
    if (next !== original) decl.value = next;
  }

  async function loadAndTransform(
    rawPath: string,
    baseDir: string,
    result: Result,
    decl: Declaration,
  ): Promise<string | null> {
    const filePath = resolveUrl(rawPath, baseDir);
    if (!filePath) {
      result.warn(`unresolvable url: ${rawPath}`, { node: decl });
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

function findDirective(rule: Rule): Declaration | undefined {
  let found: Declaration | undefined;
  rule.walkDecls((decl) => {
    if (DIRECTIVE_PROPS.has(decl.prop)) {
      found = decl;
      return false;
    }
    return undefined;
  });
  return found;
}

interface UrlMatch {
  readonly full: string;
  readonly path: string;
}

function collectUrls(value: string): ReadonlyArray<UrlMatch> {
  const matches: UrlMatch[] = [];
  URL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_PATTERN.exec(value)) !== null) {
    matches.push({ full: match[0], path: match[2]! });
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
