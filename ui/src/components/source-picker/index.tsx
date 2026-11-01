import { useCallback, useEffect, useState } from 'react';
import type { ObsClient } from '../../obs/client';
import { SourceSelect } from '../source-select';
import { buttonCls, barCls, rowCls } from '../styles.css';
import { errorCls, emptyCls } from './styles.css';

type MappingSource = { name: string; width: number; height: number };

type Props = {
  client: ObsClient;
  selected: string;
  onSelect: (name: string) => void;
};

export const SourcePicker = ({ client, selected, onSelect }: Props) => {
  const [sources, setSources] = useState<MappingSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const r = await client.listMappingSources();
    if (r.ok) {
      setSources(r.sources);
      setError(null);
    } else {
      setError(r.error);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className={`${rowCls} ${barCls}`}>
      <SourceSelect
        label="Source"
        placeholder="Select a source"
        items={sources.map((s) => ({ id: s.name, label: s.name, detail: `${String(s.width)}x${String(s.height)}` }))}
        value={selected === '' ? null : selected}
        onChange={onSelect}
      />
      <button type="button" className={buttonCls} onClick={() => void reload()}>
        Reload
      </button>
      {error === null ? null : (
        <span role="alert" className={errorCls}>
          {error}
        </span>
      )}
      {error === null && sources.length === 0 ? <span className={emptyCls}>Mapping ソースがありません</span> : null}
    </div>
  );
};
