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

/** True while a modal blocks the mapping: an open native dialog makes the whole page inert, so focus may sit on body. */
export const isInModal = (target: EventTarget | null): boolean =>
  target instanceof Element && (target.ownerDocument.querySelector('dialog[open]') !== null || target.closest('[role="dialog"][aria-modal="true"]') !== null);

/** Maps Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z to undo / redo; null outside those keys, inside text entry or inside a modal. */
export const historyAction = (e: HistoryKeyInput): UiAction | null => {
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return null;
  if (isTextEntry(e.target) || isInModal(e.target)) return null;
  return { type: e.shiftKey ? 'redo' : 'undo' };
};
