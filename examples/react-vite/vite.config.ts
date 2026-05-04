import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { defineConfig } from 'vite';
import opticalCenter from 'optical-center/vite';
import react from '@vitejs/plugin-react';

const HERE = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@fixtures': resolve(HERE, '..', '..', 'fixtures', 'icons'),
    },
  },
  plugins: [opticalCenter(), react()],
});
