import { useId, type Dispatch } from 'react';
import type { UiAction } from '../../editor/reducer';
import type { Direction, Group, GroupLayout, LayoutAlign } from '../../model/mapping';
import type { Messages } from '../../i18n/messages';
import { useT } from '../../i18n/use-t';
import { NumField, TextField } from '../field';
import { headingCls } from '../inspector/styles.css';
import { fieldsetCls, groupCls, legendCls, radioCls, rowCls, segmentCls, segmentsCls } from './styles.css';

type Option<T extends string> = { value: T; label: string };

const directionsOf = (t: Messages): readonly Option<Direction>[] => [
  { value: 'row', label: t.directionRow },
  { value: 'column', label: t.directionColumn },
];

const alignsOf = (t: Messages): readonly Option<LayoutAlign>[] => [
  { value: 'start', label: t.alignStart },
  { value: 'center', label: t.alignCenter },
  { value: 'end', label: t.alignEnd },
];

type SegmentedProps<T extends string> = { legend: string; options: readonly Option<T>[]; value: T; onChange: (v: T) => void };

const Segmented = <T extends string>({ legend, options, value, onChange }: SegmentedProps<T>) => {
  const name = useId();
  return (
    <fieldset className={fieldsetCls}>
      <legend className={legendCls}>{legend}</legend>
      <div className={segmentsCls}>
        {options.map((o) => (
          <label key={o.value} className={segmentCls}>
            <input type="radio" className={radioCls} name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

type GroupPatch = Partial<Pick<Group, 'name' | 'layout'>>;

type Props = { group: Group; dispatch: Dispatch<UiAction> };

/** Name and Auto Layout settings of the single selected group. */
export const GroupInspector = ({ group, dispatch }: Props) => {
  const t = useT();
  const patch = (p: GroupPatch): void => dispatch({ type: 'patchGroup', groupId: group.id, patch: p });
  const layout = (l: Partial<GroupLayout>): void => patch({ layout: { ...group.layout, ...l } });
  return (
    <div className={groupCls}>
      <div className={headingCls}>{t.groupHeading}</div>
      <TextField label={t.name} value={group.name} onCommit={(name) => patch({ name })} />
      <Segmented legend={t.groupDirection} options={directionsOf(t)} value={group.layout.direction} onChange={(direction) => layout({ direction })} />
      <Segmented legend={t.groupAlign} options={alignsOf(t)} value={group.layout.align} onChange={(align) => layout({ align })} />
      <div className={rowCls}>
        <NumField label={t.groupGap} value={group.layout.gap} onCommit={(gap) => layout({ gap })} />
        <NumField label={t.groupPadding} value={group.layout.padding} onCommit={(padding) => layout({ padding })} />
      </div>
    </div>
  );
};
