import { useAtomValue, useSetAtom } from 'jotai';
import { reloadSourcesAtom, selectedSourceAtom, selectSourceAtom, sourcesAtom, sourcesErrorAtom } from '../../atoms/session';
import { SourceSelect } from '../source-select';
import { buttonCls, barCls, rowCls } from '../styles.css';
import { errorCls, emptyCls } from './styles.css';

export const SourcePicker = () => {
  const sources = useAtomValue(sourcesAtom);
  const error = useAtomValue(sourcesErrorAtom);
  const selected = useAtomValue(selectedSourceAtom);
  const select = useSetAtom(selectSourceAtom);
  const reload = useSetAtom(reloadSourcesAtom);

  return (
    <div className={`${rowCls} ${barCls}`}>
      <SourceSelect
        label="Source"
        placeholder="Select a source"
        items={sources.map((s) => ({ id: s.name, label: s.name, detail: `${String(s.width)}x${String(s.height)}` }))}
        value={selected}
        onChange={select}
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
