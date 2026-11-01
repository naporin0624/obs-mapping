import { atom } from 'jotai';

export type ToastMessage = { id: number; text: string };

export const toastAtom = atom<ToastMessage | null>(null);

export const reportErrorAtom = atom(null, (get, set, text: string): void => set(toastAtom, { id: (get(toastAtom)?.id ?? 0) + 1, text }));

export const dismissToastAtom = atom(null, (_get, set): void => set(toastAtom, null));
