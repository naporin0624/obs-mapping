import type { Mapping } from '../../../ui/src/model/mapping';

export const serializeMapping = (mapping: Mapping): string => `${JSON.stringify(mapping, null, 2)}\n`;
