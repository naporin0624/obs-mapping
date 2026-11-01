import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Chromium refuses type="module" scripts (and crossorigin) on file:// pages, so emit a classic
// deferred script instead; the bundle is a single IIFE chunk (see rollupOptions below).
const classicScript = (): Plugin => ({
  name: 'classic-script',
  enforce: 'post',
  transformIndexHtml: (html) => html.replace(/<script type="module" crossorigin /g, '<script defer '),
});

// base './' and outDir ../data/ui: the plugin bundle serves the UI via file://
export default defineConfig({
  base: './',
  plugins: [react(), classicScript()],
  build: {
    outDir: '../data/ui',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
