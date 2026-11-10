import { describe, expect, it } from 'vitest';
import { mediaSides } from './layout';

describe('mediaSides', () => {
  it('alternates the side rows, starting with the screenshot at the start', () => {
    expect(mediaSides(['side', 'side', 'side'])).toEqual(['start', 'end', 'start']);
  });

  it('leaves wide rows out of the count so the side rows still alternate around them', () => {
    expect(mediaSides(['side', 'wide', 'side', 'side', 'wide', 'side'])).toEqual(['start', undefined, 'end', 'start', undefined, 'end']);
  });

  it('gives a list of wide rows no sides', () => {
    expect(mediaSides(['wide', 'wide'])).toEqual([undefined, undefined]);
  });
});
