/**
 * postcss-cli config — no bundler. Demonstrates the optical-center
 * PostCSS plugin running against the shared fixture pool through an
 * `@fixtures` alias.
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
