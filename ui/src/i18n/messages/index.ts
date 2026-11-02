import type { Locale } from '../locale';
import { en } from './en';
import { ja, type Messages } from './ja';

export type { Messages };

export const messages: Record<Locale, Messages> = { ja, en };
