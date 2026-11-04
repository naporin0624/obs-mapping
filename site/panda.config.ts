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
});
