import type { Mapping } from '../model/mapping';

export const exportMapping = (m: Mapping): string => JSON.stringify(m, null, 2);

/** Hands the JSON to the browser as a `mapping.json` download. */
export const downloadMapping = (m: Mapping): void => {
  const url = URL.createObjectURL(new Blob([exportMapping(m)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mapping.json';
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
