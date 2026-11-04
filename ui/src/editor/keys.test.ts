import { describe, expect, it } from 'vitest';
import { keyAction, type KeyInput } from './keys';

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({ key: k, shiftKey: false, metaKey: false, ctrlKey: false, ...mods });

describe('keyAction', () => {
  it('nudges 1px with arrows and 10px with shift', () => {
    expect(keyAction(key('ArrowLeft'))).toEqual({ type: 'nudge', dx: -1, dy: 0 });
    expect(keyAction(key('ArrowDown', { shiftKey: true }))).toEqual({ type: 'nudge', dx: 0, dy: 10 });
  });

  it('deletes with Delete and Backspace', () => {
    expect(keyAction(key('Delete'))).toEqual({ type: 'removeSelected' });
    expect(keyAction(key('Backspace'))).toEqual({ type: 'removeSelected' });
  });

  it('maps Cmd+Z / Cmd+Shift+Z / Cmd+D', () => {
    expect(keyAction(key('z', { metaKey: true }))).toEqual({ type: 'undo' });
    expect(keyAction(key('z', { metaKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
    expect(keyAction(key('Z', { ctrlKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
    expect(keyAction(key('d', { metaKey: true }))).toEqual({ type: 'duplicateSelected' });
  });

  it('ignores unrelated keys and modified arrows', () => {
    expect(keyAction(key('a'))).toBeNull();
    expect(keyAction(key('ArrowLeft', { metaKey: true }))).toBeNull();
  });

  it('maps Cmd+G to group and Cmd+Shift+G to ungroup', () => {
    expect(keyAction(key('g', { metaKey: true }))).toEqual({ type: 'group' });
    expect(keyAction(key('G', { metaKey: true, shiftKey: true }))).toEqual({ type: 'ungroup' });
  });

  it('ignores auto-repeat for group and ungroup', () => {
    expect(keyAction(key('g', { metaKey: true, repeat: true }))).toBeNull();
    expect(keyAction(key('g', { metaKey: true, shiftKey: true, repeat: true }))).toBeNull();
  });
});

describe('Escape', () => {
  it('exits shape edit', () => {
    expect(keyAction({ key: 'Escape', shiftKey: false, metaKey: false, ctrlKey: false })).toEqual({ type: 'exitShapeEdit' });
  });
});
