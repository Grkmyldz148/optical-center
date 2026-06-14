/**
 * postcss-cli config.
 *
 * Two plugins chained:
 *
 *   1. `optical-center/postcss` — the subject of the demo. Walks
 *      every rule containing `optical-center: auto`, rewrites
 *      every `url('…svg')` in the rule to a shifted data URI,
 *      strips the directive.
 *
 *   2. `inlineRemainingSvgUrls` (defined below, ~25 lines) — does
 *      the boring "resolve bare specifiers and inline as data
 *      URIs" job that a bundler (Vite, webpack, Next.js) would
 *      normally handle. Without it, the geometric badges in the
 *      demo's index.html would point at unresolved bare
 *      specifiers and never load via `file://`. In a real-world
 *      project you would not need this plugin — your bundler's
 *      asset pipeline takes its place.
 *
 * The two plugins are independent: optical-center handles only
 * rules that explicitly opt in; the adjunct plugin handles
 * whatever url() remains. data: URIs emitted by optical-center
 * pass through the adjunct plugin untouched (they start with
 * `data:`, not a path).
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import opticalCenter from 'optical-center/postcss';

const SVG_URL_PATTERN = /url\(\s*(['"]?)([^'")]+?\.svg)\1\s*\)/gi;

const inlineRemainingSvgUrls = () => ({
  postcssPlugin: 'inline-remaining-svg-urls',
  Once(root) {
    const cssFile = root.source?.input.file;
    const baseDir = cssFile ? dirname(cssFile) : process.cwd();
    const req = createRequire(join(baseDir, '_'));

    root.walkDecls((decl) => {
      if (!decl.value.includes('url(')) return;
      decl.value = decl.value.replace(SVG_URL_PATTERN, (full, _q, path) => {
        if (path.startsWith('data:')) return full;
        let resolved;
        try {
          resolved = path.startsWith('./') || path.startsWith('../') || isAbsolute(path)
            ? resolve(baseDir, path)
            : req.resolve(path);
        } catch {
          return full;
        }
        const svg = readFileSync(resolved, 'utf8').replace(/\s+/g, ' ').trim();
        const encoded = svg
          .replace(/%/g, '%25')
          .replace(/#/g, '%23')
          .replace(/"/g, '%22')
          .replace(/</g, '%3C')
          .replace(/>/g, '%3E')
          .replace(/\{/g, '%7B')
          .replace(/\}/g, '%7D');
        return `url("data:image/svg+xml;utf8,${encoded}")`;
      });
    });
  },
});
inlineRemainingSvgUrls.postcss = true;

export default {
  plugins: [opticalCenter(), inlineRemainingSvgUrls()],
};
