/**
 * Vite picks up `postcss.config.js` automatically. The optical-center
 * PostCSS plugin walks every CSS rule that opts in via
 * `optical-center: auto` and rewrites the `url('…svg')` calls inside
 * to inline data URIs at build time.
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
