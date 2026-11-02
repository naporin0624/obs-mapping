import { useRef, useState } from 'react';
import { useT } from '../../i18n/use-t';
import { downloadMapping } from '../../io/export';
import { parseImport, scaleMapping, type ImportResult } from '../../io/import';
import type { Mapping } from '../../model/mapping';
import { ImportDialog } from '../import-dialog';
import { IconButton } from '../icon-button';
import { ExportIcon, ImportIcon } from '../icons';

type Mismatch = Extract<ImportResult, { kind: 'mismatch' }>;

type Props = {
  mapping: Mapping;
  online: boolean;
  onApply: (m: Mapping) => Promise<boolean>;
  onError: (text: string) => void;
};

/** Import (file input) and Export (download) buttons for the toolbar. */
export const ImportExport = ({ mapping, online, onApply, onError }: Props) => {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mismatch, setMismatch] = useState<Mismatch | null>(null);

  const onFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return;
    const r = parseImport(await file.text(), mapping.canvas);
    if (r.kind === 'error') onError(r.message);
    else if (r.kind === 'ok') await onApply(r.mapping);
    else setMismatch(r);
  };
  const decide = (build: (m: Mismatch) => Mapping): void => {
    const m = mismatch;
    setMismatch(null);
    if (m !== null) void onApply(build(m));
  };

  return (
    <>
      <IconButton label={t.importButton} icon={<ImportIcon />} unavailable={online ? undefined : {}} onClick={() => fileRef.current?.click()} />
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        hidden
        aria-label={t.importFileLabel}
        onChange={(e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          input.value = ''; // selecting the same file again must fire onChange
          void onFile(file);
        }}
      />
      <IconButton label={t.exportButton} icon={<ExportIcon />} onClick={() => downloadMapping(mapping)} />
      {mismatch === null ? null : (
        <ImportDialog
          json={mismatch.mapping.canvas}
          current={mismatch.current}
          onCancel={() => setMismatch(null)}
          onOverwrite={() => decide((m) => m.mapping)}
          onScale={() => decide((m) => scaleMapping(m.mapping, m.current.width, m.current.height))}
        />
      )}
    </>
  );
};
