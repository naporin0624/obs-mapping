import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = __dirname;

const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// A hover-ish key whose block sets `transform` to something other than 'none'.
const HOVER_BLOCK = /(?:\b_hover|'[^'\n]*(?::hover|\[data-hovered\])[^'\n]*')\s*:\s*\{([^{}]*)\}/g;
const MOVING_TRANSFORM = /\btransform\s*:(?!\s*['"]none['"])/;

const movesOnHover = (source: string): boolean => [...stripComments(source).matchAll(HOVER_BLOCK)].some((m) => MOVING_TRANSFORM.test(m[1] ?? ''));

const styleFiles = readdirSync(ROOT, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.css.ts'))
  .map((path) => join(ROOT, path));

describe('movesOnHover', () => {
  it('flags a transform set under _hover', () => {
    expect(movesOnHover(`css({ _hover: { transform: 'translate(3px, 3px)' } })`)).toBe(true);
  });

  it('flags a transform set under a hovered selector', () => {
    expect(movesOnHover(`css({ '&[data-hovered]': { color: 'x', transform: 'rotate(2deg)' } })`)).toBe(true);
    expect(movesOnHover(`css({ '&:hover:not(:disabled)': { transform: 'translate(1px,1px)' } })`)).toBe(true);
  });

  it('ignores comments, transform none and non-hover blocks', () => {
    expect(movesOnHover(`// no translate on hover\ncss({ _hover: { bg: 'bg.emphasis' } })`)).toBe(false);
    expect(movesOnHover(`css({ _disabled: { transform: 'none' }, _hover: { transform: 'none' } })`)).toBe(false);
    expect(movesOnHover(`css({ transform: 'translateX(-50%)', _hover: { bg: 'bg.emphasis' } })`)).toBe(false);
  });
});

describe('component hover motion', () => {
  it('finds the style files', () => {
    expect(styleFiles.length).toBeGreaterThan(0);
  });

  it.each(styleFiles)('%s does not move on hover', (path) => {
    expect(movesOnHover(readFileSync(path, 'utf8'))).toBe(false);
  });
});
