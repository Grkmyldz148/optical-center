import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import opticalCenter from 'optical-center/vite';

export default defineConfig({
  plugins: [opticalCenter()],
  resolve: {
    alias: {
      '@fixtures': resolve(__dirname, '../../fixtures/icons'),
    },
  },
});
