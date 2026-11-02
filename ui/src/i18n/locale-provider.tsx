import type { ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import { I18nProvider } from 'react-aria-components';
import { localeAtom } from './locale';

export const LocaleProvider = ({ children }: { children: ReactNode }) => <I18nProvider locale={useAtomValue(localeAtom)}>{children}</I18nProvider>;
