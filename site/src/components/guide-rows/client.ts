export type GuideDialogDeps = {
  /** Whether the browser runs `commandfor` / `command` itself; when it does, nothing is wired. */
  supportsInvokers: boolean;
};

type Cleanup = () => void;

const defaultDeps = (): GuideDialogDeps => ({ supportsInvokers: 'commandForElement' in HTMLButtonElement.prototype });

const targetDialog = (trigger: HTMLButtonElement): HTMLDialogElement | undefined => {
  const target = trigger.ownerDocument.getElementById(trigger.getAttribute('commandfor') ?? '');
  return target instanceof HTMLDialogElement ? target : undefined;
};

const showModal = (trigger: HTMLButtonElement): void => {
  const dialog = targetDialog(trigger);
  if (dialog !== undefined && !dialog.open) dialog.showModal();
};

const listen = (trigger: HTMLButtonElement): Cleanup => {
  const handler = (): void => showModal(trigger);
  trigger.addEventListener('click', handler);
  return () => trigger.removeEventListener('click', handler);
};

/** Opens each screenshot's dialog on click in browsers without invoker commands; the returned function unwires it. */
export const initGuideDialogs = (root: ParentNode, deps: GuideDialogDeps = defaultDeps()): Cleanup => {
  if (deps.supportsInvokers) return () => undefined;
  const cleanups = [...root.querySelectorAll<HTMLButtonElement>('button[data-guide-open]')].map(listen);
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
};
