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
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('phaser')) return 'vendor-phaser';
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['phaser'],
  },
  esbuild: {
    // Strip console.log in production builds for a small perf/size gain.
    drop: ['console', 'debugger'],
  },
});
