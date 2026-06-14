/**
 * Strip dangerous content from SVG strings before they are written back
 * to disk or injected into HTML.
 *
 * The Vite + CLI pipelines re-emit SVG markup that came from disk —
 * plausibly third-party icon packages, plausibly authored by the user.
 * Either way, that markup will be served by a browser, so we narrow it
 * to a "static-rendering" subset before letting it through:
 *
 *   - inline event handlers (`onload="..."`, `onclick="..."` etc.) are
 *     dropped — they execute on parse, no user interaction needed.
 *   - `<script>` elements (any namespace) are removed wholesale.
 *   - `javascript:` URIs in `href`/`xlink:href` are rewritten to `#`.
 *   - `<foreignObject>` blocks are removed by default — they can host
 *     full HTML and re-introduce every threat we just sanitized.
 *
 * The function is conservative: it never throws, and on inputs it
 * doesn't recognize it returns the original string. The goal is "safer
 * by default", not "perfectly safe for arbitrary attacker input"; for
 * untrusted user content, route through DOMPurify upstream.
 */

const ON_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi;
const SCRIPT_TAG = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const SELF_CLOSING_SCRIPT = /<script\b[^>]*\/>/gi;
const FOREIGN_OBJECT = /<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi;
const SELF_CLOSING_FOREIGN = /<foreignObject\b[^>]*\/>/gi;
const JS_HREF = /\s(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi;

export interface SanitizeOptions {
  /** Strip inline `on*` event handlers. Default `true`. */
  readonly stripEventHandlers?: boolean;
  /** Remove `<script>` tags. Default `true`. */
  readonly stripScripts?: boolean;
  /** Remove `<foreignObject>` blocks. Default `true`. */
  readonly stripForeignObject?: boolean;
  /** Defang `javascript:` URIs in href / xlink:href. Default `true`. */
  readonly stripJavascriptUris?: boolean;
}

const DEFAULT_OPTIONS: Required<SanitizeOptions> = {
  stripEventHandlers: true,
  stripScripts: true,
  stripForeignObject: true,
  stripJavascriptUris: true,
};

export function sanitizeSvg(svg: string, options?: SanitizeOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let out = svg;

  if (opts.stripScripts) {
    out = out.replace(SCRIPT_TAG, '');
    out = out.replace(SELF_CLOSING_SCRIPT, '');
  }
  if (opts.stripForeignObject) {
    out = out.replace(FOREIGN_OBJECT, '');
    out = out.replace(SELF_CLOSING_FOREIGN, '');
  }
  if (opts.stripEventHandlers) {
    out = out.replace(ON_ATTR, '');
  }
  if (opts.stripJavascriptUris) {
    out = out.replace(JS_HREF, ' $1="#"');
  }

  return out;
}
