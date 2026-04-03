import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      phaser: 'phaser/dist/phaser.esm.js',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    minify: 'esbuild',
  },
  optimizeDeps: {
    exclude: ['phaser'],
  },
});
