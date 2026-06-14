/**
 * `optical-center/astro` — orchestrator that runs `optical-center: auto`
 * through every build-time surface Astro owns.
 *
 * It wraps the Vite plugin (so JSX/TSX modules and Vite's
 * `transformIndexHtml` hook are covered automatically) and adds a
 * post-build sweep over every emitted `*.html` file. That sweep is what
 * makes `<svg optical-center="auto">` work inside `.astro` templates,
 * which Astro emits through its own pipeline rather than Vite's
 * per-page HTML hook.
 *
 * Single user-facing API. Same declaration as everywhere else:
 *
 *   CSS:        `.foo { optical-center: auto; }`     (PostCSS plugin)
 *   HTML/JSX:   `<svg optical-center="auto">…</svg>` (this plugin)
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';

import { sanitizeSvg } from '../node/sanitize.js';
import type { SanitizeOptions } from '../node/sanitize.js';
import opticalCenterVite from '../vite/index.js';
import type { VitePluginOptions } from '../vite/index.js';
import { transformHtmlSvgs } from '../vite/transform-html-svg.js';

export type AstroPluginOptions = VitePluginOptions;

async function walkHtml(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkHtml(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

export default function opticalCenterAstro(
  options: AstroPluginOptions = {},
): AstroIntegration {
  let emitMetadata: boolean = options.emitMetadata ?? false;

  const onWarning = options.onWarning;
  const sanitizeOption = options.sanitize ?? true;
  const sanitize = (svg: string): string => {
    if (sanitizeOption === false) return svg;
    if (sanitizeOption === true) return sanitizeSvg(svg);
    return sanitizeSvg(svg, sanitizeOption as SanitizeOptions);
  };

  return {
    name: 'optical-center',
    hooks: {
      'astro:config:setup': ({ updateConfig, addMiddleware, command }) => {
        // Default emitMetadata: on in dev, off in build (matches the Vite
        // plugin's own default). The user can pin it via options.
        if (options.emitMetadata === undefined) {
          emitMetadata = command === 'dev';
        }
        // Cast through `unknown` — Astro bundles its own Vite, so the
        // Plugin type identity differs from the root's `vite` devDep.
        // The plugin object is structurally compatible at runtime.
        const plugin = opticalCenterVite({
          ...options,
          emitMetadata,
        }) as unknown;
        updateConfig({
          vite: {
            plugins: [plugin as never],
          },
        });

        // Dev only: register a middleware that rewrites `<svg optical-center>`
        // blocks in Astro's SSR'd HTML. Vite's `transformIndexHtml` doesn't
        // run against `.astro` pages, and the `astro:build:done` sweep only
        // fires in build mode — so without this, dev would render untransformed
        // SVGs while production rendered correct ones.
        if (command === 'dev') {
          addMiddleware({
            entrypoint: new URL('./dev-middleware.js', import.meta.url),
            order: 'post',
          });
        }
      },
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = await walkHtml(root);
        let rewritten = 0;
        const warn = (w: { code: string; location?: string }) => {
          logger.warn(`${w.code}${w.location ? ` @ ${w.location}` : ''}`);
          onWarning?.(w as { code: import('../core/warnings.js').WarningCode; location?: string });
        };
        for (const file of files) {
          const original = await readFile(file, 'utf8');
          const next = transformHtmlSvgs(original, {
            emitMetadata,
            sanitize,
            onWarning: warn,
          });
          if (next !== original) {
            await writeFile(file, next, 'utf8');
            rewritten++;
          }
        }
        logger.info(
          `rewrote ${rewritten} page${rewritten === 1 ? '' : 's'} with optical-center transforms`,
        );
      },
    },
  };
}
