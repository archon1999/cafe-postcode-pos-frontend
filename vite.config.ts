import fs from 'node:fs';
import path from 'path';

import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 61'],
      // Chrome 61 is the first Chrome release with native ES modules. Target
      // it for both bundles so module-capable TV browsers cannot fall into a
      // compatibility gap before Chrome 75.
      modernTargets: ['chrome >= 61'],
      modernPolyfills: true,
    }),
  ],
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), fs.realpathSync(path.resolve(__dirname, 'node_modules'))] },
    port: 4300,
    proxy: {
      '/api/v1': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8000',
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
