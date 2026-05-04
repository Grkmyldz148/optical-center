/**
 * postcss-cli config — no bundler. Bare specifiers like
 * `lucide-static/icons/play.svg` resolve through Node's module
 * resolution, so installed icon packages work without alias config.
 */

import opticalCenter from 'optical-center/postcss';

export default {
  plugins: [opticalCenter()],
};
