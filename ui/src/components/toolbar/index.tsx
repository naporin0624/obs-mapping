import type { Dispatch, ReactNode } from 'react';
import type { AlignMode } from '../../geometry/align';
import type { UiAction } from '../../editor/reducer';
import type { TileTarget } from '../../editor/tile-group';
import { useT } from '../../i18n/use-t';
import type { Messages } from '../../i18n/messages';
import { NumField } from '../field';
import { TilePopover, type TileSubject } from '../tile-popover';
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

type HistoryProps = { dispatch: Dispatch<UiAction>; canUndo: boolean; canRedo: boolean };

const HistoryGroup = ({ dispatch, canUndo, canRedo }: HistoryProps) => {
  const t = useT();
  return (
    <div className={groupCls}>
      <IconButton label={t.toolbarUndo} icon={<UndoIcon />} unavailable={unavailableWhen(!canUndo)} onClick={() => dispatch({ type: 'undo' })} />
      <IconButton label={t.toolbarRedo} icon={<RedoIcon />} unavailable={unavailableWhen(!canRedo)} onClick={() => dispatch({ type: 'redo' })} />
    </div>
  );
};

type Blocked = Extract<TileTarget, { kind: 'blocked' }>['why'];

const tileReason = (t: Messages, why: Blocked, immovableReason: string | null): string => {
  switch (why) {
    case 'noSurface':
      return immovableReason ?? t.reasonSelectSurface;
    case 'mixed':
      return t.reasonTileOneGroup;
    case 'nested':
      return t.editorImmovable;
    case 'subgroup':
      return t.reasonTileSubgroup;
    case 'empty':
      return t.reasonTileEmptyGroup;
  }
};

const tileSubject = (dispatch: Dispatch<UiAction>, target: TileTarget): TileSubject => {
  switch (target.kind) {
    case 'group':
      return { kind: 'group', count: target.count, direction: target.direction, onApply: (line) => dispatch({ type: 'tileGroup', groupId: target.groupId, ...line }) };
    case 'surfaces':
      return { kind: 'surfaces', count: target.count, onApply: (grid) => dispatch({ type: 'tile', ...grid }) };
    case 'blocked':
      return { kind: 'surfaces', count: 0, onApply: (grid) => dispatch({ type: 'tile', ...grid }) };
  }
};

type TileProps = { dispatch: Dispatch<UiAction>; target: TileTarget; canvas: { width: number; height: number }; immovableReason: string | null };

const TileGroup = ({ dispatch, target, canvas, immovableReason }: TileProps) => {
  const t = useT();
  const unavailable = target.kind === 'blocked' ? { reason: tileReason(t, target.why, immovableReason) } : undefined;
  return <TilePopover subject={tileSubject(dispatch, target)} canvas={canvas} unavailable={unavailable} />;
};

type ViewRowProps = { dispatch: Dispatch<UiAction>; gridSize: number; overlayEnabled: boolean; onToggleOverlay: () => void; children?: ReactNode };

const ViewRow = ({ dispatch, gridSize, overlayEnabled, onToggleOverlay, children }: ViewRowProps) => {
  const t = useT();
  return (
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
  /** What 敷き詰め would fit, or why it cannot. */
  tile: TileTarget;
  canvas: { width: number; height: number };
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

export const Toolbar = ({
  dispatch,
  canUndo,
  canRedo,
  selectedCount,
  immovableReason,
  tile,
  canvas,
  canGroup,
  canUngroup,
  onGroup,
  gridSize,
  overlayEnabled,
  onToggleOverlay,
  fileActions,
  children,
}: Props) => {
  const t = useT();
  return (
    <div className={`${toolbarCls} ${barCls}`}>
      <div className={rowCls}>
        <HistoryGroup dispatch={dispatch} canUndo={canUndo} canRedo={canRedo} />
        <Separator />
        <AlignGroup dispatch={dispatch} blocked={selectedCount < 1} reason={immovableReason ?? t.reasonSelectSurface} />
        <Separator />
        <DistributeGroup dispatch={dispatch} blocked={selectedCount < 3} reason={immovableReason ?? t.reasonSelectThree} />
        <Separator />
        <TileGroup dispatch={dispatch} target={tile} canvas={canvas} immovableReason={immovableReason} />
        <Separator />
        <GroupingGroup dispatch={dispatch} canGroup={canGroup} canUngroup={canUngroup} onGroup={onGroup} />
        {fileActions !== undefined && (
          <>
            <Separator />
            <div className={groupCls}>{fileActions}</div>
          </>
        )}
      </div>
      <ViewRow dispatch={dispatch} gridSize={gridSize} overlayEnabled={overlayEnabled} onToggleOverlay={onToggleOverlay}>
        {children}
      </ViewRow>
    </div>
  );
};
