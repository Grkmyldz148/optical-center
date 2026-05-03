import { defineConfig } from 'vite';
import opticalCenter from 'optical-center/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [opticalCenter(), react()],
});
