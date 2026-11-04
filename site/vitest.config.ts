import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts', 'node_modules/', 'dist/'],
        },
      },
      {
        test: {
          name: 'dist',
          environment: 'node',
          include: ['tests/dist/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              // Software WebGL so headless runs without a GPU (CI) render the same as locally.
              launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
