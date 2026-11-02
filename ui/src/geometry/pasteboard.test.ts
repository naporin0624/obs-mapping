import { describe, expect, it } from 'vitest';
import { pasteboardBounds, pasteboardMargin } from './pasteboard';

describe('pasteboardMargin', () => {
  it('is an eighth of the longer canvas side, rounded to whole px', () => {
    expect(pasteboardMargin({ width: 1920, height: 1080 })).toBe(240);
    expect(pasteboardMargin({ width: 1080, height: 1920 })).toBe(240);
    expect(pasteboardMargin({ width: 1281, height: 720 })).toBe(160);
  });
});

describe('pasteboardBounds', () => {
  it('surrounds the canvas with the margin on every side', () => {
    expect(pasteboardBounds({ width: 1920, height: 1080 })).toEqual({ x: -240, y: -240, width: 2400, height: 1560 });
  });
});
