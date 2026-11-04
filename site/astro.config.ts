import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  vite: {
    // three.js alone is ~700 kB minified; the demo page cannot render without it.
    build: { chunkSizeWarningLimit: 800 },
  },
  i18n: {
    defaultLocale: 'ja',
    locales: ['ja', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
