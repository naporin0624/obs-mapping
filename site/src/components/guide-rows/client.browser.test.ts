/// <reference types="@vitest/browser/matchers" />

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { initGuideDialogs } from './client';

// Mirrors the trigger and dialog that index.astro renders for one screenshot.
const buildDom = (): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = `
    <button type="button" commandfor="guide-test" command="show-modal" data-guide-open>
      <img alt="screen" width="10" height="10" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
    </button>
    <dialog id="guide-test" aria-label="screen">
      <form method="dialog"><button data-guide-close>close</button></form>
    </dialog>
  `;
  document.body.append(root);
  return root;
};

let root: HTMLElement;
let cleanups: (() => void)[] = [];

const trigger = (): HTMLButtonElement => {
  const found = root.querySelector('[data-guide-open]');
  if (!(found instanceof HTMLButtonElement)) throw new Error('no trigger');
  return found;
};
const dialog = (): HTMLDialogElement => {
  const found = root.querySelector('dialog');
  if (!(found instanceof HTMLDialogElement)) throw new Error('no dialog');
  return found;
};
const closeButton = (): HTMLButtonElement => {
  const found = root.querySelector('[data-guide-close]');
  if (!(found instanceof HTMLButtonElement)) throw new Error('no close button');
  return found;
};

const start = (supportsInvokers: boolean): void => {
  cleanups = [...cleanups, initGuideDialogs(root, { supportsInvokers })];
};

beforeEach(() => {
  root = buildDom();
});

afterEach(() => {
  cleanups.forEach((stop) => stop());
  cleanups = [];
  root.remove();
});

describe.each([
  ['with native invoker commands', true],
  ['with the click fallback', false],
])('guide screenshot dialog %s', (_label, supportsInvokers) => {
  it('opens as a modal when the screenshot is clicked', async () => {
    start(supportsInvokers);
    await userEvent.click(trigger());
    expect(dialog().open).toBe(true);
    expect(dialog().matches(':modal')).toBe(true);
  });

  it('closes on Escape and returns focus to the screenshot', async () => {
    start(supportsInvokers);
    await userEvent.click(trigger());
    await userEvent.keyboard('{Escape}');
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(trigger());
  });

  it('closes from its close button and returns focus to the screenshot', async () => {
    start(supportsInvokers);
    await userEvent.click(trigger());
    await userEvent.click(closeButton());
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(trigger());
  });
});

describe('initGuideDialogs fallback', () => {
  it('opens the dialog itself when the browser ignores the command', async () => {
    trigger().removeAttribute('command');
    start(false);
    await userEvent.click(trigger());
    expect(dialog().open).toBe(true);
  });

  it('stops opening dialogs after cleanup', async () => {
    const stop = initGuideDialogs(root, { supportsInvokers: false });
    stop();
    // Hide the native behaviour so only the fallback could open it.
    trigger().removeAttribute('command');
    await userEvent.click(trigger());
    expect(dialog().open).toBe(false);
  });
});
