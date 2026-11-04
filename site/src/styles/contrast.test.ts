import { wcagContrast, parse } from 'culori';
import { describe, expect, it } from 'vitest';
import { cannelloniPreset } from '../../../ui/src/design/cannelloni-preset';

const { tokens, semanticTokens } = cannelloniPreset.theme.extend;

const lookup = (path: string): string => {
  const node = path
    .split('.')
    .reduce<unknown>((tree, key) => (typeof tree === 'object' && tree !== null ? (tree as Record<string, unknown>)[key] : undefined), { colors: { ...tokens.colors, ...semanticTokens.colors } });
  if (typeof node !== 'object' || node === null || !('value' in node) || typeof node.value !== 'string') throw new Error(`token not found: ${path}`);
  return node.value;
};

const resolve = (path: string): string => {
  const value = lookup(path);
  const ref = /^\{(.+)\}$/.exec(value);
  return ref?.[1] === undefined ? value : resolve(ref[1]);
};

const ratio = (fg: string, bg: string): number => {
  const f = parse(resolve(`colors.${fg}`));
  const b = parse(resolve(`colors.${bg}`));
  if (f === undefined || b === undefined) throw new Error(`unparsable colour: ${fg} / ${bg}`);
  return wcagContrast(f, b);
};

describe('Cannelloni preset contrast (WCAG 2.1 AA)', () => {
  it.each([
    ['fg.default', 'bg.canvas', 4.5],
    ['fg.muted', 'bg.canvas', 4.5],
    ['fg.subtle', 'bg.canvas', 4.5],
    ['fg.on-solid', 'accent.solid', 4.5],
    ['fg.on-solid', 'accent.solid-hover', 4.5],
    ['fg.default', 'bg.muted', 4.5],
    ['accent.solid-hover', 'bg.canvas', 4.5],
    ['accent.text', 'bg.canvas', 4.5],
    ['accent.text', 'bg.muted', 4.5],
    ['fg.muted', 'bg.emphasis', 4.5],
    ['fg.default', 'bg.emphasis', 4.5],
    ['border.focus', 'bg.canvas', 3],
    ['border.focus', 'bg.emphasis', 3],
  ] as const)('%s on %s >= %s', (fg, bg, min) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});
