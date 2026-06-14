/**
 * Scan HTML for `<svg optical-center>` blocks and rewrite their viewBox in
 * place. Used by the Vite plugin's `transformIndexHtml` hook so that
 * vanilla HTML and SSR output get the same treatment as JSX.
 *
 * Why a regex and not a real parser?
 *   - The tag we care about is well-formed by SVG rules; arbitrary HTML
 *     in surrounding `<body>` content stays untouched.
 *   - parse5 / node-html-parser pull a real dependency for one feature
 *     that has a bounded scope; the plan's research insight noted this.
 *   - We bail (leave the markup untouched) on anything we can't match
 *     cleanly, so a false negative is "no transform applied", never
 *     "garbage output".
 */

import { applyTransformToSvg } from '../core/apply-to-svg.js';
import { transformViewBoxFromSvg } from '../node/transform-viewbox-from-svg.js';
import type { ViewBoxTransformResult } from '../core/transform-viewbox.js';
import type { WarningCode } from '../core/warnings.js';

export interface HtmlTransformOptions {
  readonly emitMetadata: boolean;
  readonly onWarning?: (warning: { code: WarningCode; location?: string }) => void;
  /**
   * Optional pass to scrub dangerous content (scripts, on* handlers,
   * javascript: URIs) before re-emitting the SVG. Defaults to identity.
   */
  readonly sanitize?: (svg: string) => string;
}

/*
 * `optical-center` MUST appear as a real attribute on `<svg>` — preceded by
 * whitespace (separator from the previous attr) and followed by `=`,
 * whitespace, `/`, or `>` (token boundary). Without these guards, dev-time
 * `data-astro-source-file="…/optical-center-main/…"` would false-positive
 * because `\boptical-center\b` matches inside the quoted path.
 */
const SVG_BLOCK = /<svg\b[^>]*\s+optical-center(?=[\s=/>])[^>]*>[\s\S]*?<\/svg>/gi;
const OC_ATTR = /\s(?:optical-center)(?:\s*=\s*("[^"]*"|'[^']*'))?(?=\s|\/?>|$)/i;
const OPENING_TAG = /<([a-zA-Z][\w-]*)\b([^>]*?)(\/?)>/g;
const NAME_CHAR = /[a-zA-Z_:0-9-]/;

/**
 * SSR frameworks (Astro, Svelte, Vue) sometimes emit bare attributes like
 * `data-astro-cid-abc123` with no `=""` value. That's valid HTML5, but
 * resvg's strict XML parser rejects it during rasterization. Walk each
 * opening tag's attribute string and quote any bare attribute we find —
 * values stay untouched, framework selectors still match.
 *
 * Tokenizer instead of regex: path values like `d="M 25 25 v 50 l 50"`
 * contain spaces and identifiers that a naive regex misreads as new
 * attributes.
 */
function normalizeAttrs(attrs: string): string {
  const out: string[] = [];
  let i = 0;
  const n = attrs.length;
  while (i < n) {
    const c = attrs[i] as string;
    if (/\s/.test(c)) {
      out.push(c);
      i++;
      continue;
    }
    // Read attribute name
    const nameStart = i;
    while (i < n && NAME_CHAR.test(attrs[i] as string)) i++;
    if (i === nameStart) {
      // Not a name char — leave it and advance to avoid infinite loop.
      out.push(c);
      i++;
      continue;
    }
    const name = attrs.slice(nameStart, i);
    // Skip whitespace after name to find `=` or boundary
    let j = i;
    while (j < n && /\s/.test(attrs[j] as string)) j++;
    if (j < n && attrs[j] === '=') {
      // attr=value — emit name + whitespace + = + value
      out.push(name, attrs.slice(i, j), '=');
      j++;
      while (j < n && /\s/.test(attrs[j] as string)) j++;
      const q = attrs[j];
      if (q === '"' || q === "'") {
        const valStart = j;
        j++;
        while (j < n && attrs[j] !== q) j++;
        if (j < n) j++; // include closing quote
        out.push(attrs.slice(valStart, j));
      } else {
        // unquoted value: read until whitespace or end
        const valStart = j;
        while (j < n && !/\s/.test(attrs[j] as string)) j++;
        out.push(attrs.slice(valStart, j));
      }
      i = j;
    } else {
      // Bare attribute — quote it
      out.push(name, '=""');
    }
  }
  return out.join('');
}

function quoteBareAttributes(svg: string): string {
  return svg.replace(OPENING_TAG, (_, tag, attrs, slash) => {
    return `<${tag}${normalizeAttrs(attrs as string)}${slash}>`;
  });
}

export function transformHtmlSvgs(
  html: string,
  options: HtmlTransformOptions,
): string {
  const sanitize = options.sanitize ?? ((s) => s);
  return html.replace(SVG_BLOCK, (svg) => {
    const explicit = svg.match(/\boptical-center\s*=\s*["']([^"']*)["']/i);
    if (explicit && explicit[1] !== undefined) {
      const value = explicit[1];
      if (value === 'false' || value === 'none') return svg;
      if (value !== '' && value !== 'auto' && value !== 'true') return svg;
    }

    // Strip the boolean `optical-center` attribute and quote any other
    // bare attributes BEFORE rasterizing — resvg's strict XML parser
    // rejects unquoted attribute names like `data-astro-cid-xyz`.
    const stripped = sanitize(quoteBareAttributes(svg.replace(OC_ATTR, '')));

    let result: ViewBoxTransformResult;
    try {
      result = transformViewBoxFromSvg(stripped, {
        emitMetadata: options.emitMetadata,
      });
    } catch {
      options.onWarning?.({ code: 'OPTICAL_RASTERIZE_FAILED' });
      return sanitize(svg);
    }

    const next = applyTransformToSvg(stripped, {
      viewBox: result.viewBox,
      breadcrumb: result.breadcrumb,
    });
    if (result.clipDetected) {
      options.onWarning?.({ code: 'OPTICAL_CLIP_DETECTED' });
    }
    return next;
  });
}
