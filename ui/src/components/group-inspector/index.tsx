import { useId, type Dispatch } from 'react';
import type { Action } from '../../editor/reducer';
import type { Direction, Group, GroupLayout, LayoutAlign } from '../../model/mapping';
import { NumField, TextField } from '../field';
import { headingCls } from '../inspector/styles.css';
import { fieldsetCls, groupCls, legendCls, radioCls, rowCls, segmentCls, segmentsCls } from './styles.css';

type Option<T extends string> = { value: T; label: string };

const DIRECTIONS: readonly Option<Direction>[] = [
  { value: 'row', label: '横に並べる' },
  { value: 'column', label: '縦に並べる' },
];

const ALIGNS: readonly Option<LayoutAlign>[] = [
  { value: 'start', label: '先頭' },
  { value: 'center', label: '中央' },
  { value: 'end', label: '末尾' },
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

type Props = { group: Group; dispatch: Dispatch<Action> };

/** Name and Auto Layout settings of the single selected group. */
export const GroupInspector = ({ group, dispatch }: Props) => {
  const patch = (p: GroupPatch): void => dispatch({ type: 'patchGroup', groupId: group.id, patch: p });
  const layout = (l: Partial<GroupLayout>): void => patch({ layout: { ...group.layout, ...l } });
  return (
    <div className={groupCls}>
      <div className={headingCls}>Group</div>
      <TextField label="名前" value={group.name} onCommit={(name) => patch({ name })} />
      <Segmented legend="方向" options={DIRECTIONS} value={group.layout.direction} onChange={(direction) => layout({ direction })} />
      <Segmented legend="揃え" options={ALIGNS} value={group.layout.align} onChange={(align) => layout({ align })} />
      <div className={rowCls}>
        <NumField label="間隔" value={group.layout.gap} onCommit={(gap) => layout({ gap })} />
        <NumField label="余白" value={group.layout.padding} onCommit={(padding) => layout({ padding })} />
      </div>
    </div>
  );
};
