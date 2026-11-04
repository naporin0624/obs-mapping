import { defineConfig, definePreset } from '@pandacss/dev';
import { cannelloniPreset } from './src/design/cannelloni-preset';

export default defineConfig({
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda', definePreset(cannelloniPreset)],
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'styled-system',
  jsxFramework: 'react',
  theme: {
    extend: {
      keyframes: {
        marching: {
          '0%': { backgroundPosition: '0 0, 0 100%, 0 0, 100% 0' },
          '100%': { backgroundPosition: '8px 0, -8px 100%, 0 -8px, 100% 8px' },
        },
      },
    },
  },
  globalCss: {
    'html, body, #root': { height: '100%' },
    body: { bg: 'bg.canvas', color: 'fg.default', fontFamily: 'body', fontSize: '12px', lineHeight: '1.5', margin: 0 },
    '*, *::before, *::after': { borderRadius: '0' },
  },
});
