import { useAtomValue, useSetAtom } from 'jotai';
import { reloadSourcesAtom, selectedSourceAtom, selectSourceAtom, sourcesAtom, sourcesErrorAtom } from '../../atoms/session';
import { localizeError } from '../../i18n/localize-error';
import { useT } from '../../i18n/use-t';
import { SourceSelect } from '../source-select';
import { buttonCls, barCls, rowCls } from '../styles.css';
import { errorCls, emptyCls } from './styles.css';

export const SourcePicker = () => {
  const t = useT();
  const sources = useAtomValue(sourcesAtom);
  const error = useAtomValue(sourcesErrorAtom);
  const selected = useAtomValue(selectedSourceAtom);
  const select = useSetAtom(selectSourceAtom);
  const reload = useSetAtom(reloadSourcesAtom);

  return (
    <div className={`${rowCls} ${barCls}`}>
      <SourceSelect
        label={t.source}
        placeholder={t.sourcePlaceholder}
        items={sources.map((s) => ({ id: s.name, label: s.name, detail: `${String(s.width)}x${String(s.height)}` }))}
        value={selected}
        onChange={select}
      />
      <button type="button" className={buttonCls} onClick={() => void reload()}>
        {t.sourceReload}
      </button>
      {error === null ? null : (
        <span role="alert" className={errorCls}>
          {localizeError(t, error)}
        </span>
      )}
      {error === null && sources.length === 0 ? <span className={emptyCls}>{t.sourceEmpty}</span> : null}
    </div>
  );
};
