import { atom } from 'jotai';
import { localizeError } from '../../i18n/localize-error';
import { messagesAtom } from '../../i18n/messages-atom';

export type ToastMessage = { id: number; text: string };

export const toastAtom = atom<ToastMessage | null>(null);

export const reportErrorAtom = atom(null, (get, set, text: string): void => set(toastAtom, { id: (get(toastAtom)?.id ?? 0) + 1, text: localizeError(get(messagesAtom), text) }));

export const dismissToastAtom = atom(null, (_get, set): void => set(toastAtom, null));
