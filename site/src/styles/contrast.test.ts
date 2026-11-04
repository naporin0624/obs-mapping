import { readFileSync } from 'node:fs';
import { wcagContrast, parse } from 'culori';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

const declarations: Map<string, string> = new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? '', (m[2] ?? '').trim()]));

const resolve = (name: string): string => {
  const value = declarations.get(`--color-${name}`);
  if (value === undefined) throw new Error(`token not found: ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  return ref?.[1] === undefined ? value : resolve(ref[1].replace('--color-', ''));
};

const ratio = (fg: string, bg: string): number => {
  const f = parse(resolve(fg));
  const b = parse(resolve(bg));
  if (f === undefined || b === undefined) throw new Error(`unparsable colour: ${fg} / ${bg}`);
  return wcagContrast(f, b);
};

describe('tokens.css contrast (WCAG 2.1 AA)', () => {
  it.each([
    ['fg-default', 'bg-canvas', 4.5],
    ['fg-muted', 'bg-canvas', 4.5],
    ['fg-subtle', 'bg-canvas', 4.5],
    ['fg-on-solid', 'accent-solid', 4.5],
    ['fg-on-solid', 'accent-solid-hover', 4.5],
    ['fg-default', 'bg-muted', 4.5],
    ['accent-solid-hover', 'bg-canvas', 4.5],
    ['accent-text', 'bg-canvas', 4.5],
    ['accent-text', 'bg-muted', 4.5],
    ['fg-muted', 'bg-emphasis', 4.5],
    ['fg-default', 'bg-emphasis', 4.5],
    ['border-focus', 'bg-canvas', 3],
    ['border-focus', 'bg-emphasis', 3],
  ] as const)('%s on %s >= %s', (fg, bg, min) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});
