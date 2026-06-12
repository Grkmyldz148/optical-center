/**
 * Dev-time HTML transform middleware.
 *
 * Astro's `astro:build:done` hook sweeps every emitted `*.html` file at the
 * end of a production build. Dev mode has no equivalent — `.astro` pages are
 * rendered through Astro's own SSR pipeline, not Vite's `transformIndexHtml`
 * hook, so `<svg optical-center>` blocks in `.astro` templates would never
 * be rewritten while developing.
 *
 * This middleware fills that gap. It intercepts every HTML response, runs
 * the same `transformHtmlSvgs` pass the build sweep uses, and returns a new
 * Response with the rewritten body. Same defaults as the dev-mode Vite
 * plugin: `emitMetadata: true`, sanitize on.
 *
 * Registered via `addMiddleware` only when `command === 'dev'`.
 */

import type { MiddlewareHandler } from 'astro';

import { sanitizeSvg } from '../node/sanitize.js';
import { transformHtmlSvgs } from '../vite/transform-html-svg.js';

export const onRequest: MiddlewareHandler = async (_context, next) => {
  const response = await next();

  if (!response.ok) return response;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  const transformed = transformHtmlSvgs(html, {
    emitMetadata: true,
    sanitize: sanitizeSvg,
  });

  const headers = new Headers(response.headers);
  headers.delete('content-length');

  return new Response(transformed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
