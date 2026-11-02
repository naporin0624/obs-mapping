import type { Dispatch, ReactNode } from 'react';
import type { AlignMode } from '../../geometry/align';
import type { UiAction } from '../../editor/reducer';
import { useT } from '../../i18n/use-t';
import type { Messages } from '../../i18n/messages';
import { NumField } from '../field';
import { IconButton, type Unavailable } from '../icon-button';
import {
  AlignBottomIcon,
  AlignCenterHIcon,
  AlignCenterVIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  DistributeHIcon,
  DistributeVIcon,
  GroupIcon,
  RedoIcon,
  UndoIcon,
  UngroupIcon,
} from '../icons';
import { barCls, buttonSolidCls, buttonCls, rowCls } from '../styles.css';
import { groupCls, separatorCls, toolbarCls } from './styles.css';

const alignsOf = (t: Messages): readonly { mode: AlignMode; label: string; icon: ReactNode }[] => [
  { mode: 'left', label: t.alignLeft, icon: <AlignLeftIcon /> },
  { mode: 'centerX', label: t.alignCenterX, icon: <AlignCenterHIcon /> },
  { mode: 'right', label: t.alignRight, icon: <AlignRightIcon /> },
  { mode: 'top', label: t.alignTop, icon: <AlignTopIcon /> },
  { mode: 'centerY', label: t.alignCenterY, icon: <AlignCenterVIcon /> },
  { mode: 'bottom', label: t.alignBottom, icon: <AlignBottomIcon /> },
];

const distributesOf = (t: Messages): readonly { axis: 'x' | 'y'; label: string; icon: ReactNode }[] => [
  { axis: 'x', label: t.distributeHorizontal, icon: <DistributeHIcon /> },
  { axis: 'y', label: t.distributeVertical, icon: <DistributeVIcon /> },
];

const Separator = () => <span role="separator" aria-orientation="vertical" className={separatorCls} />;

const unavailableWhen = (blocked: boolean, reason?: string): Unavailable | undefined => (blocked ? { reason } : undefined);

type GroupProps = { dispatch: Dispatch<UiAction>; blocked: boolean; reason: string };

const AlignGroup = ({ dispatch, blocked, reason }: GroupProps) => {
  const t = useT();
  return (
    <div className={groupCls}>
      {alignsOf(t).map((a) => (
        <IconButton key={a.mode} label={a.label} icon={a.icon} unavailable={unavailableWhen(blocked, reason)} onClick={() => dispatch({ type: 'align', mode: a.mode })} />
      ))}
    </div>
  );
};

const DistributeGroup = ({ dispatch, blocked, reason }: GroupProps) => {
  const t = useT();
  return (
    <div className={groupCls}>
      {distributesOf(t).map((d) => (
        <IconButton key={d.axis} label={d.label} icon={d.icon} unavailable={unavailableWhen(blocked, reason)} onClick={() => dispatch({ type: 'distribute', axis: d.axis })} />
      ))}
    </div>
  );
};

type GroupingProps = { dispatch: Dispatch<UiAction>; canGroup: boolean; canUngroup: boolean; onGroup: () => void };

const GroupingGroup = ({ dispatch, canGroup, canUngroup, onGroup }: GroupingProps) => {
  const t = useT();
  return (
    <div className={groupCls}>
      <IconButton label={t.groupAction} icon={<GroupIcon />} unavailable={unavailableWhen(!canGroup, t.reasonSelectItem)} onClick={onGroup} />
      <IconButton
        label={t.ungroupAction}
        icon={<UngroupIcon />}
        unavailable={unavailableWhen(!canUngroup, canGroup ? t.reasonSelectGroup : t.reasonSelectItem)}
        onClick={() => dispatch({ type: 'ungroup' })}
      />
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
  /** Import / export buttons, mounted as the last cluster of the first row. */
  fileActions?: ReactNode;
  /** Extra controls appended to the second row. */
  children?: ReactNode;
};

export const Toolbar = ({ dispatch, canUndo, canRedo, selectedCount, immovableReason, canGroup, canUngroup, onGroup, gridSize, overlayEnabled, onToggleOverlay, fileActions, children }: Props) => {
  const t = useT();
  return (
    <div className={`${toolbarCls} ${barCls}`}>
      <div className={rowCls}>
        <div className={groupCls}>
          <IconButton label={t.toolbarUndo} icon={<UndoIcon />} unavailable={unavailableWhen(!canUndo)} onClick={() => dispatch({ type: 'undo' })} />
          <IconButton label={t.toolbarRedo} icon={<RedoIcon />} unavailable={unavailableWhen(!canRedo)} onClick={() => dispatch({ type: 'redo' })} />
        </div>
        <Separator />
        <AlignGroup dispatch={dispatch} blocked={selectedCount < 1} reason={immovableReason ?? t.reasonSelectSurface} />
        <Separator />
        <DistributeGroup dispatch={dispatch} blocked={selectedCount < 3} reason={immovableReason ?? t.reasonSelectThree} />
        <Separator />
        <GroupingGroup dispatch={dispatch} canGroup={canGroup} canUngroup={canUngroup} onGroup={onGroup} />
        {fileActions !== undefined && (
          <>
            <Separator />
            <div className={groupCls}>{fileActions}</div>
          </>
        )}
      </div>
      <div className={rowCls}>
        <NumField label={t.toolbarGrid} value={gridSize} onCommit={(size) => dispatch({ type: 'setGrid', size })} />
        <button type="button" className={overlayEnabled ? buttonSolidCls : buttonCls} aria-pressed={overlayEnabled} onClick={onToggleOverlay}>
          {t.toolbarOverlay}
        </button>
        {children !== undefined && (
          <>
            <Separator />
            {children}
          </>
        )}
      </div>
    </div>
  );
};
