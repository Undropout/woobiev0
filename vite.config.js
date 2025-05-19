import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  assetsInclude: ['**/*.woff2'], // ✅ ensure font files are treated as assets
});
