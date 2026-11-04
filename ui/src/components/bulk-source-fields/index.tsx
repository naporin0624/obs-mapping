import { useId, type Dispatch } from 'react';
import { bulkSourceOptions, summarizeSources, type SourceSummary } from '../../editor/bulk-source';
import type { UiAction } from '../../editor/reducer';
import type { Messages } from '../../i18n/messages';
import { useT } from '../../i18n/use-t';
import type { Surface } from '../../model/mapping';
import { headingCls, hintCls } from '../inspector/styles.css';
import { SourceSelect } from '../source-select';
import { itemCls, listCls, nameCls, panelCls, sourceCls } from './styles.css';

type Props = { targets: readonly Surface[]; inputs: readonly string[]; counts: ReadonlyMap<string, number>; dispatch: Dispatch<UiAction> };

const placeholderOf = (t: Messages, summary: SourceSummary): string => (summary.kind === 'mixed' ? t.bulkMixed(summary.count) : t.unassigned);

const valueOf = (summary: SourceSummary): string | null => (summary.kind === 'same' && summary.source !== '' ? summary.source : null);

const SourceField = ({ targets, inputs, counts, dispatch }: Props) => {
  const t = useT();
  const summary = summarizeSources(targets);
  return (
    <SourceSelect
      label={t.source}
      placeholder={placeholderOf(t, summary)}
      items={bulkSourceOptions(inputs, targets).map((name) => ({ id: name, label: name, detail: t.surfaceCount(counts.get(name) ?? 0) }))}
      value={valueOf(summary)}
      onChange={(source) => dispatch({ type: 'setSources', surfaceIds: targets.map((s) => s.id), source })}
    />
  );
};

const TargetList = ({ targets }: Pick<Props, 'targets'>) => {
  const t = useT();
  const headingId = useId();
  return (
    <>
      <div id={headingId} className={headingCls}>
        {t.bulkTargetsHeading}
      </div>
      <ul role="list" aria-labelledby={headingId} className={listCls}>
        {targets.map((s) => (
          <li key={s.id} className={itemCls}>
            <span className={nameCls}>{s.name}</span>
            <span className={sourceCls}>{s.source === '' ? `(${t.unassigned})` : s.source}</span>
          </li>
        ))}
      </ul>
    </>
  );
};

/** Swaps the source of every target layer at once. */
export const BulkSourceFields = (props: Props) => {
  const t = useT();
  if (props.targets.length === 0) return <div className={hintCls}>{t.bulkEmpty}</div>;
  return (
    <div className={panelCls}>
      <div className={headingCls}>{t.bulkHeading(props.targets.length)}</div>
      <SourceField {...props} />
      <TargetList targets={props.targets} />
    </div>
  );
};
