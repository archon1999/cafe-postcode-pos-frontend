import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4300,
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      app: path.resolve(__dirname, './src/app'),
      modules: path.resolve(__dirname, './src/modules'),
      shared: path.resolve(__dirname, './src/shared'),
      src: path.resolve(__dirname, './src'),
    },
  },
});
