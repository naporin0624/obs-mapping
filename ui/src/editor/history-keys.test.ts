// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { historyAction, isInModal, isTextEntry, type HistoryKeyInput } from './history-keys';

const mount = <T extends HTMLElement>(el: T): T => {
  document.body.append(el);
  return el;
};

const input = (type: string): HTMLInputElement => {
  const el = document.createElement('input');
  el.type = type;
  return mount(el);
};

const press = (k: string, target: EventTarget | null, mods: Partial<HistoryKeyInput> = {}): HistoryKeyInput => ({
  key: k,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  target,
  ...mods,
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('isTextEntry', () => {
  it('treats text inputs, textareas and contenteditable as text entry', () => {
    expect(isTextEntry(input('text'))).toBe(true);
    expect(isTextEntry(input('number'))).toBe(true);
    expect(isTextEntry(mount(document.createElement('textarea')))).toBe(true);
    const editable = mount(document.createElement('div'));
    editable.setAttribute('contenteditable', 'true');
    const child = document.createElement('span');
    editable.append(child);
    expect(isTextEntry(child)).toBe(true);
  });

  it('does not treat buttons, toggles or plain elements as text entry', () => {
    expect(isTextEntry(mount(document.createElement('button')))).toBe(false);
    expect(isTextEntry(input('checkbox'))).toBe(false);
    expect(isTextEntry(input('radio'))).toBe(false);
    expect(isTextEntry(input('range'))).toBe(false);
    expect(isTextEntry(mount(document.createElement('div')))).toBe(false);
    expect(isTextEntry(null)).toBe(false);
    expect(isTextEntry(window)).toBe(false);
  });

  it('does not treat contenteditable="false" as text entry', () => {
    const el = mount(document.createElement('div'));
    el.setAttribute('contenteditable', 'false');
    expect(isTextEntry(el)).toBe(false);
  });
});

const inside = <T extends HTMLElement>(container: HTMLElement, el: T): T => {
  container.append(el);
  mount(container);
  return el;
};

describe('isInModal', () => {
  it('is true inside an open native dialog', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    expect(isInModal(inside(dialog, document.createElement('button')))).toBe(true);
  });

  it('is true anywhere while a native dialog is open, since the rest of the page is inert', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    mount(dialog);
    expect(isInModal(document.body)).toBe(true);
    expect(isInModal(mount(document.createElement('button')))).toBe(true);
  });

  it('is true inside an aria-modal dialog', () => {
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    expect(isInModal(inside(modal, document.createElement('button')))).toBe(true);
  });

  it('is false inside a closed dialog or a non-modal role="dialog" popover', () => {
    expect(isInModal(inside(document.createElement('dialog'), document.createElement('button')))).toBe(false);
    const popover = document.createElement('section');
    popover.setAttribute('role', 'dialog');
    expect(isInModal(inside(popover, document.createElement('button')))).toBe(false);
    expect(isInModal(mount(document.createElement('button')))).toBe(false);
    expect(isInModal(null)).toBe(false);
    expect(isInModal(window)).toBe(false);
  });
});

describe('historyAction', () => {
  it('ignores Cmd+Z and Cmd+Shift+Z inside an open modal dialog', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    const button = inside(dialog, document.createElement('button'));
    expect(historyAction(press('z', button, { metaKey: true }))).toBeNull();
    expect(historyAction(press('z', button, { metaKey: true, shiftKey: true }))).toBeNull();
  });

  it('still maps Cmd+Z inside a non-modal popover dialog', () => {
    const popover = document.createElement('section');
    popover.setAttribute('role', 'dialog');
    expect(historyAction(press('z', inside(popover, document.createElement('button')), { metaKey: true }))).toEqual({ type: 'undo' });
  });

  it('maps Cmd/Ctrl+Z to undo and Cmd/Ctrl+Shift+Z to redo outside text entry', () => {
    const button = mount(document.createElement('button'));
    expect(historyAction(press('z', button, { metaKey: true }))).toEqual({ type: 'undo' });
    expect(historyAction(press('z', button, { ctrlKey: true }))).toEqual({ type: 'undo' });
    expect(historyAction(press('z', button, { metaKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
    expect(historyAction(press('Z', button, { ctrlKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
  });

  it('leaves Cmd+Z to the browser inside text entry', () => {
    expect(historyAction(press('z', input('text'), { metaKey: true }))).toBeNull();
    expect(historyAction(press('z', input('text'), { metaKey: true, shiftKey: true }))).toBeNull();
  });

  it('ignores other keys and unmodified z', () => {
    const button = mount(document.createElement('button'));
    expect(historyAction(press('z', button))).toBeNull();
    expect(historyAction(press('d', button, { metaKey: true }))).toBeNull();
    expect(historyAction(press('g', button, { metaKey: true }))).toBeNull();
  });
});
