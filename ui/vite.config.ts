import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Chromium refuses type="module" scripts (and crossorigin) on file:// pages, so emit a classic
// deferred script instead and drop crossorigin from the stylesheet link; the bundle is a single IIFE
// chunk plus one CSS file (see build options below).
const classicScript = (): Plugin => ({
  name: 'classic-script',
  enforce: 'post',
  transformIndexHtml: (html) => {
    const out = html.replace(/<script type="module" crossorigin /g, '<script defer ').replace(/<link rel="stylesheet" crossorigin /g, '<link rel="stylesheet" ');
    // a module script would silently not run from file:// inside OBS: fail the build instead
    if (/type=["']module["']/.test(out)) throw new Error('classic-script: index.html still contains a type="module" script');
    return out;
  },
});

// base './' and outDir ../data/ui: the plugin bundle serves the UI via file://
export default defineConfig({
  base: './',
  plugins: [react(), classicScript()],
  build: {
    outDir: '../data/ui',
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
