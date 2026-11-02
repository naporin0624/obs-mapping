import { useAtomValue } from 'jotai';
import { messagesAtom } from './messages-atom';

export const useT = () => useAtomValue(messagesAtom);
