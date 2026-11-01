import { useCallback, useEffect, useState } from 'react';
import { css } from '../../styled-system/css';
import type { ObsClient } from '../obs/client';
import { buttonCls, inputCls, labelCls, rowCls } from './styles';

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
    <div className={`${rowCls} ${css({ px: '8px', py: '6px', bg: 'bg.panel', borderBottom: '1px solid token(colors.line)' })}`}>
      <label className={labelCls}>
        Mapping ソース{' '}
        <select className={inputCls} value={selected} onChange={(e) => onSelect(e.target.value)}>
          <option value="">選択してください</option>
          {sources.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} ({s.width}x{s.height})
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={buttonCls} onClick={() => void reload()}>
        更新
      </button>
      {error === null ? null : (
        <span role="alert" className={css({ color: 'danger' })}>
          {error}
        </span>
      )}
      {error === null && sources.length === 0 ? <span className={css({ color: 'text.dim' })}>Mapping ソースがありません</span> : null}
    </div>
  );
};
