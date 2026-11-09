import type { UiAction } from './reducer';

export type HistoryKeyInput = { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; target: EventTarget | null };

const NON_TEXT_INPUTS: ReadonlySet<string> = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);

/** True when the browser's own text undo should handle Cmd+Z for this target. */
export const isTextEntry = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return target.isContentEditable || target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
};

/** Maps Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z to undo / redo; null outside those keys or inside text entry. */
export const historyAction = (e: HistoryKeyInput): UiAction | null => {
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return null;
  if (isTextEntry(e.target)) return null;
  return { type: e.shiftKey ? 'redo' : 'undo' };
};
