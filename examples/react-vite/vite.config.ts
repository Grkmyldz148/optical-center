import { defineConfig } from 'vite';
import opticalCenter from 'optical-center/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [opticalCenter(), react()],
  // Modern target stops esbuild's CSS transform from adding the
  // `-webkit-mask` prefix — `mask` is unprefixed in Safari 17.4+.
  build: { cssTarget: 'safari18' },
});
