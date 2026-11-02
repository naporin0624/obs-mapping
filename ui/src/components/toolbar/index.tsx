import type { Dispatch, ReactNode } from 'react';
import type { AlignMode } from '../../geometry/align';
import type { UiAction } from '../../editor/reducer';
import { useT } from '../../i18n/use-t';
import type { Messages } from '../../i18n/messages';
import { NumField } from '../field';
import { barCls, buttonCls, buttonSolidCls, rowCls } from '../styles.css';
import { tagCls, groupCls, reasonCls } from './styles.css';

const ALIGN_REASON_ID = 'align-reason';
const DISTRIBUTE_REASON_ID = 'distribute-reason';
const GROUP_REASON_ID = 'group-reason';

const alignsOf = (t: Messages): readonly { mode: AlignMode; label: string }[] => [
  { mode: 'left', label: t.alignLeft },
  { mode: 'centerX', label: t.alignCenterX },
  { mode: 'right', label: t.alignRight },
  { mode: 'top', label: t.alignTop },
  { mode: 'centerY', label: t.alignCenterY },
  { mode: 'bottom', label: t.alignBottom },
];

const distributesOf = (t: Messages): readonly { axis: 'x' | 'y'; label: string }[] => [
  { axis: 'x', label: t.distributeHorizontal },
  { axis: 'y', label: t.distributeVertical },
];

type GroupProps = { dispatch: Dispatch<UiAction>; blocked: boolean; reason: string };

const AlignGroup = ({ dispatch, blocked, reason }: GroupProps) => {
  const t = useT();
  return (
    <div className={groupCls}>
      <span className={tagCls}>{t.toolbarAlign}</span>
      {blocked && (
        <span id={ALIGN_REASON_ID} className={reasonCls}>
          {reason}
        </span>
      )}
      {alignsOf(t).map((a) => (
        <button key={a.mode} type="button" className={buttonCls} disabled={blocked} aria-describedby={blocked ? ALIGN_REASON_ID : undefined} onClick={() => dispatch({ type: 'align', mode: a.mode })}>
          {a.label}
        </button>
      ))}
    </div>
  );
};

const DistributeGroup = ({ dispatch, blocked, reason }: GroupProps) => {
  const t = useT();
  return (
    <div className={groupCls}>
      <span className={tagCls}>{t.toolbarDistribute}</span>
      {blocked && (
        <span id={DISTRIBUTE_REASON_ID} className={reasonCls}>
          {reason}
        </span>
      )}
      {distributesOf(t).map((d) => (
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
};

type GroupingProps = { dispatch: Dispatch<UiAction>; canGroup: boolean; canUngroup: boolean; onGroup: () => void };

const groupingReason = (t: Messages, canGroup: boolean, canUngroup: boolean): string | null => {
  if (!canGroup) return t.reasonSelectItem;
  return canUngroup ? null : t.reasonSelectGroup;
};

const GroupingGroup = ({ dispatch, canGroup, canUngroup, onGroup }: GroupingProps) => {
  const t = useT();
  const reason = groupingReason(t, canGroup, canUngroup);
  return (
    <div className={groupCls}>
      <span className={tagCls}>{t.toolbarGroup}</span>
      {reason !== null && (
        <span id={GROUP_REASON_ID} className={reasonCls}>
          {reason}
        </span>
      )}
      <button type="button" className={buttonCls} disabled={!canGroup} aria-describedby={canGroup ? undefined : GROUP_REASON_ID} onClick={onGroup}>
        {t.groupAction}
      </button>
      <button type="button" className={buttonCls} disabled={!canUngroup} aria-describedby={canUngroup ? undefined : GROUP_REASON_ID} onClick={() => dispatch({ type: 'ungroup' })}>
        {t.ungroupAction}
      </button>
    </div>
  );
};

type Props = {
  dispatch: Dispatch<UiAction>;
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

export const Toolbar = ({ dispatch, canUndo, canRedo, selectedCount, immovableReason, canGroup, canUngroup, onGroup, gridSize, overlayEnabled, onToggleOverlay, children }: Props) => {
  const t = useT();
  return (
    <div className={`${rowCls} ${barCls}`}>
      <div className={groupCls}>
        <button type="button" className={buttonCls} disabled={!canUndo} onClick={() => dispatch({ type: 'undo' })}>
          {t.toolbarUndo}
        </button>
        <button type="button" className={buttonCls} disabled={!canRedo} onClick={() => dispatch({ type: 'redo' })}>
          {t.toolbarRedo}
        </button>
      </div>
      <AlignGroup dispatch={dispatch} blocked={selectedCount < 1} reason={immovableReason ?? t.reasonSelectSurface} />
      <DistributeGroup dispatch={dispatch} blocked={selectedCount < 3} reason={immovableReason ?? t.reasonSelectThree} />
      <GroupingGroup dispatch={dispatch} canGroup={canGroup} canUngroup={canUngroup} onGroup={onGroup} />
      <div className={groupCls}>
        <NumField label={t.toolbarGrid} value={gridSize} onCommit={(size) => dispatch({ type: 'setGrid', size })} />
        <button type="button" className={overlayEnabled ? buttonSolidCls : buttonCls} aria-pressed={overlayEnabled} onClick={onToggleOverlay}>
          {t.toolbarOverlay}
        </button>
      </div>
      {children}
    </div>
  );
};
