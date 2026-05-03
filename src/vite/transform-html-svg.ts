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

const SVG_BLOCK = /<svg\b[^>]*\boptical-center\b[^>]*>[\s\S]*?<\/svg>/gi;
const OC_ATTR = /\s(?:optical-center)(?:\s*=\s*("[^"]*"|'[^']*'))?(?=\s|\/?>|$)/i;

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

    // Strip the boolean `optical-center` attribute BEFORE rasterizing —
    // resvg's strict XML parser rejects bare attribute names.
    const stripped = sanitize(svg.replace(OC_ATTR, ''));

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
