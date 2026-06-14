import { createRequire } from 'node:module';

import { defineConfig } from 'vite';
import opticalCenter from 'optical-center/vite';
import react from '@vitejs/plugin-react';

import { availablePrefixes } from './src/lib/iconifyLocal.js';

const require = createRequire(import.meta.url);

/**
 * Every curated family the stress view can expand, resolved to its real
 * `@iconify/json` file. Fed to `server.warmup` so the optical-center
 * correction for each set runs in the background at server start — by the
 * time a family header is clicked, the corrected module is already in
 * Vite's module graph and the click resolves instantly. Without this, the
 * first click per family pays the whole correction (seconds to minutes on
 * a cold cache) inside the dynamic import.
 */
const iconSetFiles = [...availablePrefixes()].map((prefix) =>
  require.resolve(`@iconify/json/json/${prefix}.json`),
);

/**
 * The entire optical-center setup is one plugin. No custom middleware, no
 * precompute script, no committed offset artefacts.
 *
 *   opticalCenter()  Build-time. Rewrites statically-authored
 *                    `<svg optical-center>` in the stage, AND auto-corrects
 *                    every Iconify set the stress view imports — detected by
 *                    shape, body-wrapped at build/dev time. The browser never
 *                    runs the model.
 *   react()          Standard React refresh / JSX.
 */
export default defineConfig({
  plugins: [opticalCenter(), react()],
  build: { cssTarget: 'safari18' },
  server: { warmup: { clientFiles: iconSetFiles } },
});
