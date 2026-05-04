/**
 * Vite picks up `postcss.config.js` automatically. The optical-center
 * plugin walks every CSS rule that opts in via `optical-center: auto`
 * and rewrites the `url('…svg')` calls inside to inline data URIs at
 * build time. Bare specifiers like `lucide-static/icons/play.svg`
 * resolve through Node's module resolution.
 */

import opticalCenter from 'optical-center/postcss';

export default {
  plugins: [opticalCenter()],
};
