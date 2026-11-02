import type { Messages } from '../i18n/messages';

export type Naming = { surface: (number: string) => string; group: (number: string) => string; copy: (name: string) => string };

export const namingOf = (t: Messages): Naming => ({ surface: t.defaultSurfaceName, group: t.defaultGroupName, copy: t.copyName });
