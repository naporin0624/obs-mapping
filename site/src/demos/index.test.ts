import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { serializeMapping } from '../scene/serialize';
import { mappings, scenes } from './index';

const SLUGS = ['stairs', 'hexagon', 'drums', 'cubes'] as const;

describe('demos', () => {
  it.each(SLUGS)('keys %s by its own slug', (slug) => {
    expect(scenes[slug].slug).toBe(slug);
  });

  it.each(SLUGS)('serializes %s back to the committed mapping.json byte for byte', (slug) => {
    const committed = readFileSync(new URL(`./${slug}/mapping.json`, import.meta.url), 'utf8');
    expect(serializeMapping(mappings[slug])).toBe(committed);
  });
});
