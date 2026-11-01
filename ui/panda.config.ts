import { defineConfig } from '@pandacss/dev';

// Dark theme matching OBS's dark UI; accent matches the plugin overlay outline.
export default defineConfig({
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda'],
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'styled-system',
  jsxFramework: 'react',
  theme: {
    extend: {
      tokens: {
        colors: {
          bg: { base: { value: '#1e1f22' }, panel: { value: '#2b2d31' }, raised: { value: '#383a40' }, input: { value: '#1a1b1e' } },
          line: { value: '#3f4147' },
          text: { base: { value: '#e6e6e6' }, dim: { value: '#9a9da4' } },
          accent: { value: '#00e5ff' },
          danger: { value: '#ff4d4f' },
        },
        fonts: {
          ui: { value: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Segoe UI', sans-serif" },
          mono: { value: "ui-monospace, 'SF Mono', Menlo, monospace" },
        },
      },
    },
  },
  globalCss: {
    'html, body, #root': { height: '100%' },
    body: { bg: 'bg.base', color: 'text.base', fontFamily: 'ui', fontSize: '12px', margin: 0 },
  },
});
