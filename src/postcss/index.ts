/**
 * `optical-center/postcss` — bundler-agnostic build-time CSS path.
 *
 * One directive: `optical-center: auto`. The plugin picks the right
 * surface based on what's present in the rule.
 *
 *   1. URL-rewrite mode. The rule mounts an SVG via `url('…svg')`
 *      (mask-image, background-image, etc.). The plugin walks every
 *      declaration, runs each url through the rasterize →
 *      optical-center → viewBox-rewrite pipeline, and replaces the
 *      URL with an inline `data:image/svg+xml,…` URI. The perceptual
 *      shift is baked into the rewritten viewBox; no positioning is
 *      emitted — the consumer's surrounding layout (flex item, grid
 *      cell, etc.) decides where the icon sits.
 *
 *        .icon {
 *          background-image: url('icons/play.svg');
 *          optical-center: auto;
 *        }
 *
 *      → emitted CSS:
 *
 *        .icon {
 *          background-image: url('data:image/svg+xml,…rewritten…');
 *          --optical-center: auto;
 *        }
 *
 *   2. JSX-scan mode (container-side). The rule has no `url()` — its
 *      selector matches a JSX element that WRAPS an icon rendered by
 *      a runtime icon component (e.g. lucide-react). The directive
 *      lives on the container, exactly like `justify-content: center`
 *      lives on a flex parent. The plugin scans the project's
 *      `.jsx`/`.tsx` source once at build time, finds JSX usages of
 *      components imported from supported icon packages, and records
 *      every ancestor JSX element's `className` token as a container
 *      that wraps that icon.
 *
 *        // src/Button.tsx
 *        import { Play } from 'lucide-react';
 *        <div className="badge">
 *          <Play />
 *        </div>
 *
 *        // styles.css — directive on the container, not the icon
 *        .badge { optical-center: auto; }
 *
 *      → emitted CSS:
 *
 *        .badge {
 *          display: flex;
 *          --optical-center: auto;
 *        }
 *        .badge > * {
 *          margin: auto;
 *          translate: 0.1% 2.589%;
 *        }
 *
 *      Hard rules on the directive's own rule:
 *        - NO `align-items: center` / `justify-content: center` — the
 *          directive replaces those properties, it doesn't co-exist
 *          with them.
 *        - NO `position: absolute` on the child — the child stays in
 *          normal flow so the container plays nicely with any layout
 *          the consumer wraps around it.
 *
 *      Centering mechanism: `display: flex` on the container makes
 *      the icon a flex item; `margin: auto` on that flex item absorbs
 *      all free space along both axes — a well-known centering trick
 *      that uses neither `align-items` nor `justify-content`. The
 *      perceptual translate layers on top. `--optical-center: auto`
 *      stays as a DevTools tracer. `margin: auto` is always emitted
 *      on the child; `translate` is dropped when the offset is zero.
 *
 * In both modes the original `optical-center` declaration is replaced
 * with a `--optical-center: auto` tracer custom property. It has no
 * rendering effect — browsers ignore unknown custom property values
 * here — but it stays visible in DevTools so the author can confirm
 * the rule was processed (the perceptual shift in URL-rewrite mode is
 * baked into the rewritten data URI, which is otherwise invisible).
 * The plain `optical-center` form and the `--optical-center` form are
 * both accepted as the directive input.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import type { Declaration, PluginCreator, Result, Root, Rule } from 'postcss';

import { applyTransformToSvg } from '../core/apply-to-svg.js';
import { MAX_INPUT_BYTES } from '../core/constants.js';
import type { WarningCode } from '../core/warnings.js';
import { sanitizeSvg } from '../node/sanitize.js';
import type { SanitizeOptions } from '../node/sanitize.js';
import { transformViewBoxFromSvg } from '../node/transform-viewbox-from-svg.js';

import { scanProject } from './jsx-scan.js';
import type { PackageResolver, ScanResult } from './jsx-scan.js';
import { existsSync } from 'node:fs';

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
  /**
   * Project root used as the starting directory for the JSX scan that
   * powers the no-`url()` fallback. Defaults to the CSS source file's
   * nearest enclosing `package.json`, falling back to `process.cwd()`.
   */
  readonly projectRoot?: string;
  /**
   * Override the icon-package map used by the JSX scanner. Each entry
   * maps an npm package id to a function that turns a PascalCase
   * import name into a bare SVG specifier (Node-resolvable). Default
   * covers `lucide-react` → `lucide-static/icons/<kebab>.svg`.
   */
  readonly iconPackages?: Readonly<Record<string, PackageResolver>>;
}

const DIRECTIVE_PROPS = new Set(['optical-center', '--optical-center']);

const URL_PATTERN =
  /url\(\s*(['"]?)([^'")]+?\.svg)\1\s*\)/gi;

const CLASS_PATTERN = /\.(-?[_a-zA-Z][\w-]*)/g;

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

      // Kick off the JSX scan once per CSS file. It's memoized
      // per-project-root inside scanProject, so multiple stylesheets
      // share the same in-flight promise.
      const projectRoot = options.projectRoot ?? findProjectRoot(baseDir);
      const scanPromise = options.iconPackages
        ? scanProject(projectRoot, options.iconPackages)
        : scanProject(projectRoot);

      const tasks: Array<Promise<void>> = [];
      cssRoot.walkRules((rule) => {
        const directive = findDirective(rule);
        if (!directive) return;
        const value = directive.value.trim();

        if (value === 'auto') {
          tasks.push(processRule(rule, directive, baseDir, helpers.result, scanPromise));
          return;
        }

        // Anything else (e.g. `optical-center: none`) is left as-is so
        // it's visible in the output if the author meant something.
      });
      await Promise.all(tasks);
    },
  };

  async function processRule(
    rule: Rule,
    directive: Declaration,
    baseDir: string,
    result: Result,
    scanPromise: Promise<ScanResult>,
  ): Promise<void> {
    const urlDecls: Declaration[] = [];
    rule.walkDecls((decl) => {
      if (DIRECTIVE_PROPS.has(decl.prop)) return;
      // Cheap substring filter — `URL_PATTERN.test` would mutate the
      // shared regex's lastIndex (it has the /g flag) and break the
      // next call. The full match runs in rewriteDeclaration.
      if (!decl.value.includes('url(')) return;
      urlDecls.push(decl);
    });

    if (urlDecls.length > 0) {
      // URL-rewrite mode: the rule's element IS the icon. The
      // perceptual shift is baked into the rewritten data URI inside
      // every `url('…svg')` declaration in the rule. The plugin does
      // NOT emit positioning — that would constrain how the consumer
      // can place the icon (flow vs. absolute vs. flex item, etc.).
      // Leave `--optical-center: auto` as a DevTools tracer so the
      // author can confirm the rule was processed (the URI rewrite
      // is otherwise invisible).
      directive.replaceWith({ prop: '--optical-center', value: 'auto' });
      await Promise.all(
        urlDecls.map((decl) => rewriteDeclaration(decl, baseDir, result)),
      );
      return;
    }

    // Container-side mode (no url() in the rule). The rule's selector
    // identifies a container that wraps an icon. We always emit the
    // centering block — the consumer wrote `optical-center: auto` on
    // a container and they expect their icon child to be centered,
    // regardless of how the icon's perceptual shift is produced
    // (translate from a JSX-scan match, viewBox rewrite by Babel for
    // inline `<svg>`, or `mask: url()` rewrite on a child rule).
    //
    // The perceptual `translate` is only emitted when the JSX scan
    // resolves the container class to a known icon-component SVG —
    // i.e. when this plugin owns the shift end-to-end. In the other
    // two modes the shift is baked into the asset itself and the
    // child rule only needs the `margin: auto` centering helper.
    const scan = await scanPromise;
    const svgPath = pickSvgFromSelectors(rule.selectors, scan);
    await emitContainer(rule, directive, svgPath, result);
  }

  async function emitContainer(
    rule: Rule,
    directive: Declaration,
    svgPath: string | null,
    result: Result,
  ): Promise<void> {
    // Hard contract for the directive's own rule: NO `align-items` /
    // `justify-content: center` and NO `position: absolute` on the
    // child — both would break real-world use. Centering is achieved
    // by `display: flex` on the container and `margin: auto` on the
    // child (well-known flex auto-margin technique). Child stays in
    // normal flow.
    const childDecls = ['margin: auto'];

    if (svgPath) {
      try {
        const svg = await readFile(svgPath, 'utf8');
        if (svg.length <= maxInputBytes) {
          const sanitized = sanitize(svg);
          const transform = transformViewBoxFromSvg(sanitized, { emitMetadata });
          if (transform.clipDetected) {
            onWarning?.({ code: 'OPTICAL_CLIP_DETECTED', location: svgPath });
          }
          const dx = formatPercent(transform.offset.dxPercent);
          const dy = formatPercent(transform.offset.dyPercent);
          if (dx !== '0%' || dy !== '0%') {
            childDecls.push(`translate: ${dx} ${dy}`);
          }
        } else {
          onWarning?.({ code: 'OPTICAL_RASTERIZE_FAILED', location: svgPath });
        }
      } catch (err) {
        result.warn(
          `optical-center: failed to compute offset for ${svgPath}: ${(err as Error).message}`,
          { node: directive },
        );
        onWarning?.({ code: 'OPTICAL_RASTERIZE_FAILED', location: svgPath });
      }
    }

    directive.before({ prop: 'display', value: 'flex' });
    directive.replaceWith({ prop: '--optical-center', value: 'auto' });
    rule.after(`${rule.selector} > * { ${childDecls.join('; ')} }`);
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
    if (rawUrl.startsWith('./') || rawUrl.startsWith('../')) {
      return resolve(baseDir, rawUrl);
    }

    // Bare specifier — try Node's resolution against the CSS source's
    // directory. This makes `url('lucide-static/icons/play.svg')` and
    // `url('@fortawesome/fontawesome-free/svgs/solid/play.svg')` work
    // without any alias config, which is the whole point of using
    // installed icon packages.
    try {
      const req = createRequire(join(baseDir, '_placeholder'));
      return req.resolve(rawUrl);
    } catch {
      return resolve(baseDir, rawUrl);
    }
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
 * Walk upward from `start` until a directory containing `package.json`
 * is found. That's the project root the JSX scan should anchor on.
 * Falls back to `start` if nothing is found before the filesystem
 * root.
 */
function findProjectRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

/**
 * Pick the first SVG path that any class token in any of `selectors`
 * resolves to via `scan.classToSvg`. Selectors are tried in source
 * order; classes within a selector are tried left-to-right.
 */
function pickSvgFromSelectors(
  selectors: ReadonlyArray<string>,
  scan: ScanResult,
): string | null {
  for (const selector of selectors) {
    CLASS_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = CLASS_PATTERN.exec(selector)) !== null) {
      const cls = match[1]!;
      const hit = scan.classToSvg.get(cls);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Format an offset percentage for emission as a `translate` value.
 * Trims trailing zeros and folds tiny offsets to `0%` so we can detect
 * the "no shift needed" case at the call site.
 */
function formatPercent(n: number): string {
  if (Math.abs(n) < 0.0001) return '0%';
  return `${n.toFixed(4).replace(/\.?0+$/, '')}%`;
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
