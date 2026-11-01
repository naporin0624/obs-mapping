import { defineConfig } from '@pandacss/dev';

// Cannelloni design system (dark only): square corners, 1px borders, one electric-blue accent.
// Only the tokens this UI uses are ported; names follow tokens.json (colors-bg-canvas -> colors.bg.canvas).
export default defineConfig({
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda'],
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
      tokens: {
        colors: {
          dark: {
            canvas: { value: 'oklch(0.180 0 0)' },
            subtle: { value: 'oklch(0.225 0 0)' },
            muted: { value: 'oklch(0.270 0 0)' },
            emphasis: { value: 'oklch(0.300 0 0)' },
            'border-subtle': { value: 'oklch(0.380 0 0)' },
            border: { value: 'oklch(0.520 0 0)' },
            'border-strong': { value: 'oklch(0.620 0 0)' },
          },
          gray: {
            '1': { value: 'oklch(0.952 0.004 265)' },
            '6': { value: 'oklch(0.845 0.008 265)' },
            '8': { value: 'oklch(0.700 0.013 265)' },
          },
          neon: { blue: { value: 'oklch(0.700 0.235 260)' }, 'blue-hover': { value: 'oklch(0.650 0.235 260)' } },
          red: { solid: { value: 'oklch(0.520 0.200 25)' }, text: { value: 'oklch(0.650 0.250 25)' } },
        },
        fonts: {
          body: { value: '"LINE Seed JP", system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif' },
          mono: { value: '"LINE Seed JP", system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif' },
        },
        radii: {
          none: { value: '0' },
          xs: { value: '0' },
          sm: { value: '0' },
          md: { value: '0' },
          lg: { value: '0' },
          pill: { value: '9999px' },
        },
        borderWidths: { none: { value: '0' }, default: { value: '1px' }, strong: { value: '2px' } },
        sizes: { 'target-min': { value: '24px' } },
        opacity: { disabled: { value: '0.5' } },
      },
      semanticTokens: {
        colors: {
          bg: {
            canvas: { value: '{colors.dark.canvas}' },
            subtle: { value: '{colors.dark.subtle}' },
            muted: { value: '{colors.dark.muted}' },
            emphasis: { value: '{colors.dark.emphasis}' },
          },
          fg: {
            default: { value: '{colors.gray.1}' },
            muted: { value: '{colors.gray.6}' },
            subtle: { value: '{colors.gray.8}' },
            'on-solid': { value: '{colors.dark.canvas}' },
            'on-danger': { value: '{colors.gray.1}' },
          },
          border: {
            subtle: { value: '{colors.dark.border-subtle}' },
            default: { value: '{colors.dark.border}' },
            strong: { value: '{colors.dark.border-strong}' },
            focus: { value: '{colors.neon.blue}' },
          },
          accent: {
            solid: { value: '{colors.neon.blue}' },
            'solid-hover': { value: '{colors.neon.blue-hover}' },
            text: { value: '{colors.neon.blue}' },
            border: { value: '{colors.neon.blue}' },
          },
          danger: {
            solid: { value: '{colors.red.solid}' },
            text: { value: '{colors.red.text}' },
            border: { value: '{colors.red.text}' },
          },
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
