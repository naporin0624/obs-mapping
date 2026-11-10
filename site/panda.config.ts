import { defineConfig, definePreset } from '@pandacss/dev';
import { cannelloniPreset } from '../ui/src/design/cannelloni-preset';
import { globalCss } from './src/styles/global-css';

// No preflight: the pages rely on the browser's default margins and list markers.
export default defineConfig({
  presets: ['@pandacss/preset-base', definePreset(cannelloniPreset)],
  preflight: false,
  include: ['./src/**/*.{astro,ts}'],
  exclude: ['./src/**/*.test.ts'],
  outdir: 'styled-system',
  globalCss,
  // The top page puts its contents nav beside the 48rem column once both fit.
  theme: { extend: { breakpoints: { twoColumn: '64rem' } } },
});
