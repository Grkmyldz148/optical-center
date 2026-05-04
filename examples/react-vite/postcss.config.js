/**
 * Vite picks up `postcss.config.js` automatically. The optical-center
 * PostCSS plugin walks every CSS rule that opts in via
 * `optical-center: auto` and rewrites the `url('…svg')` references it
 * contains. No alias config is needed for installed icon packages —
 * the plugin falls back to Node's resolution for bare specifiers, so
 * `url('lucide-static/icons/play.svg')` and `url('heroicons/24/solid/star.svg')`
 * just work.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import opticalCenter from 'optical-center/postcss';

const HERE = dirname(fileURLToPath(import.meta.url));

export default {
  plugins: [
    opticalCenter({
      aliases: {
        '@fixtures': resolve(HERE, '..', '..', 'fixtures', 'icons'),
      },
    }),
  ],
};
