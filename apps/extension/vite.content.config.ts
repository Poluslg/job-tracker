import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  publicDir: false,
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    
    emptyOutDir: false,
    target: 'chrome116',
    lib: {
      entry: resolve(import.meta.dirname, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'JobAIContentScript',
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: { extend: true },
    },
  },
});
