import type { Dispatch, ReactNode } from 'react';
import type { AlignMode } from '../../geometry/align';
import type { Action } from '../../editor/reducer';
import { NumField } from '../field';
import { barCls, buttonCls, buttonSolidCls, rowCls } from '../styles.css';
import { tagCls, groupCls, reasonCls } from './styles.css';

const ALIGN_REASON_ID = 'align-reason';
const DISTRIBUTE_REASON_ID = 'distribute-reason';
const GROUP_REASON_ID = 'group-reason';

const ALIGNS: readonly { mode: AlignMode; label: string }[] = [
  { mode: 'left', label: 'Left' },
  { mode: 'centerX', label: 'Center' },
  { mode: 'right', label: 'Right' },
  { mode: 'top', label: 'Top' },
  { mode: 'centerY', label: 'Middle' },
  { mode: 'bottom', label: 'Bottom' },
];

const DISTRIBUTES: readonly { axis: 'x' | 'y'; label: string }[] = [
  { axis: 'x', label: 'Horizontal' },
  { axis: 'y', label: 'Vertical' },
];

type GroupProps = { dispatch: Dispatch<Action>; blocked: boolean; reason: string };

const AlignGroup = ({ dispatch, blocked, reason }: GroupProps) => (
  <div className={groupCls}>
    <span className={tagCls}>Align</span>
    {blocked && (
      <span id={ALIGN_REASON_ID} className={reasonCls}>
        {reason}
      </span>
    )}
    {ALIGNS.map((a) => (
      <button key={a.mode} type="button" className={buttonCls} disabled={blocked} aria-describedby={blocked ? ALIGN_REASON_ID : undefined} onClick={() => dispatch({ type: 'align', mode: a.mode })}>
        {a.label}
      </button>
    ))}
  </div>
);

const DistributeGroup = ({ dispatch, blocked, reason }: GroupProps) => (
  <div className={groupCls}>
    <span className={tagCls}>Distribute</span>
    {blocked && (
      <span id={DISTRIBUTE_REASON_ID} className={reasonCls}>
        {reason}
      </span>
    )}
    {DISTRIBUTES.map((d) => (
      <button
        key={d.axis}
        type="button"
        className={buttonCls}
        disabled={blocked}
        aria-describedby={blocked ? DISTRIBUTE_REASON_ID : undefined}
        onClick={() => dispatch({ type: 'distribute', axis: d.axis })}
      >
        {d.label}
      </button>
    ))}
  </div>
);

type GroupingProps = { dispatch: Dispatch<Action>; canGroup: boolean; canUngroup: boolean; onGroup: () => void };

const groupingReason = (canGroup: boolean, canUngroup: boolean): string | null => {
  if (!canGroup) return '面かグループを選択';
  return canUngroup ? null : 'グループを選択';
};

const GroupingGroup = ({ dispatch, canGroup, canUngroup, onGroup }: GroupingProps) => {
  const reason = groupingReason(canGroup, canUngroup);
  return (
    <div className={groupCls}>
      <span className={tagCls}>Group</span>
      {reason !== null && (
        <span id={GROUP_REASON_ID} className={reasonCls}>
          {reason}
        </span>
      )}
      <button type="button" className={buttonCls} disabled={!canGroup} aria-describedby={canGroup ? undefined : GROUP_REASON_ID} onClick={onGroup}>
        グループ化
      </button>
      <button type="button" className={buttonCls} disabled={!canUngroup} aria-describedby={canUngroup ? undefined : GROUP_REASON_ID} onClick={() => dispatch({ type: 'ungroup' })}>
        グループ解除
      </button>
    </div>
  );
};

type Props = {
  dispatch: Dispatch<Action>;
  canUndo: boolean;
  canRedo: boolean;
  selectedCount: number;
  /** Why a non-empty selection cannot be aligned; null when it is empty or movable. */
  immovableReason: string | null;
  canGroup: boolean;
  canUngroup: boolean;
  onGroup: () => void;
  gridSize: number;
  overlayEnabled: boolean;
  onToggleOverlay: () => void;
  /** Slot for extra controls (import / export are mounted here). */
  children?: ReactNode;
};

export const Toolbar = ({ dispatch, canUndo, canRedo, selectedCount, immovableReason, canGroup, canUngroup, onGroup, gridSize, overlayEnabled, onToggleOverlay, children }: Props) => (
  <div className={`${rowCls} ${barCls}`}>
    <div className={groupCls}>
      <button type="button" className={buttonCls} disabled={!canUndo} onClick={() => dispatch({ type: 'undo' })}>
        Undo
      </button>
      <button type="button" className={buttonCls} disabled={!canRedo} onClick={() => dispatch({ type: 'redo' })}>
        Redo
      </button>
    </div>
    <AlignGroup dispatch={dispatch} blocked={selectedCount < 1} reason={immovableReason ?? '面を選択'} />
    <DistributeGroup dispatch={dispatch} blocked={selectedCount < 3} reason={immovableReason ?? '3面以上を選択'} />
    <GroupingGroup dispatch={dispatch} canGroup={canGroup} canUngroup={canUngroup} onGroup={onGroup} />
    <div className={groupCls}>
      <NumField label="Grid" value={gridSize} onCommit={(size) => dispatch({ type: 'setGrid', size })} />
      <button type="button" className={overlayEnabled ? buttonSolidCls : buttonCls} aria-pressed={overlayEnabled} onClick={onToggleOverlay}>
        Overlay
      </button>
    </div>
    {children}
  </div>
);
