/**
 * Vite picks up `postcss.config.js` automatically. Once the
 * optical-center plugin is registered, every CSS rule that contains
 * `optical-center: auto` gets every `url('…svg')` inside it rewritten
 * to a corrected data URI at build time.
 *
 * Bare specifiers like `lucide-static/icons/play.svg` resolve through
 * Node's module resolution, so installed icon packages work without
 * any alias config.
 */

import opticalCenter from 'optical-center/postcss';

export default {
  plugins: [opticalCenter()],
};
