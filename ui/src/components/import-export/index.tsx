import { useRef, useState } from 'react';
import { downloadMapping } from '../../io/export';
import { parseImport, scaleMapping, type ImportResult } from '../../io/import';
import type { Mapping } from '../../model/mapping';
import { ImportDialog } from '../import-dialog';
import { buttonCls } from '../styles.css';

type Mismatch = Extract<ImportResult, { kind: 'mismatch' }>;

type Props = {
  mapping: Mapping;
  online: boolean;
  onApply: (m: Mapping) => Promise<boolean>;
  onError: (text: string) => void;
};

/** Import (file input) and Export (download) buttons for the toolbar. */
export const ImportExport = ({ mapping, online, onApply, onError }: Props) => {
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
      <button type="button" className={buttonCls} disabled={!online} onClick={() => fileRef.current?.click()}>
        Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        hidden
        aria-label="Import JSON"
        onChange={(e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          input.value = ''; // selecting the same file again must fire onChange
          void onFile(file);
        }}
      />
      <button type="button" className={buttonCls} onClick={() => downloadMapping(mapping)}>
        Export
      </button>
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
