import { atom } from 'jotai';
import { localeAtom } from './locale';
import { messages } from './messages';

export const messagesAtom = atom((get) => messages[get(localeAtom)]);
