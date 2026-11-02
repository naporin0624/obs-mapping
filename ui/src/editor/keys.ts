import type { UiAction } from './reducer';

export type KeyInput = { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; repeat?: boolean };

const NUDGE_SMALL = 1;
const NUDGE_LARGE = 10;

const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const commandAction = (key: string, shift: boolean): UiAction | null => {
  switch (key.toLowerCase()) {
    case 'z':
      return { type: shift ? 'redo' : 'undo' };
    case 'd':
      return shift ? null : { type: 'duplicateSelected' };
    case 'g':
      return { type: shift ? 'ungroup' : 'group' };
    default:
      return null;
  }
};

/** Maps a keydown on the Stage to an editor action; null when the key is not a shortcut. */
export const keyAction = (e: KeyInput): UiAction | null => {
  if (e.metaKey || e.ctrlKey) return e.repeat === true && e.key.toLowerCase() === 'g' ? null : commandAction(e.key, e.shiftKey);
  const arrow = ARROWS[e.key];
  if (arrow !== undefined) {
    const step = e.shiftKey ? NUDGE_LARGE : NUDGE_SMALL;
    return { type: 'nudge', dx: arrow[0] * step, dy: arrow[1] * step };
  }
  return e.key === 'Delete' || e.key === 'Backspace' ? { type: 'removeSelected' } : null;
};
