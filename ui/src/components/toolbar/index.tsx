import type { Dispatch, ReactNode } from 'react';
import type { AlignMode } from '../../geometry/align';
import type { Action } from '../../editor/reducer';
import { NumField } from '../field';
import { barCls, buttonCls, buttonSolidCls, rowCls } from '../styles.css';
import { tagCls, groupCls, reasonCls } from './styles.css';

const ALIGN_REASON_ID = 'align-reason';
const DISTRIBUTE_REASON_ID = 'distribute-reason';

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

type GroupProps = { dispatch: Dispatch<Action>; blocked: boolean };

const AlignGroup = ({ dispatch, blocked }: GroupProps) => (
  <div className={groupCls}>
    <span className={tagCls}>Align</span>
    {blocked && (
      <span id={ALIGN_REASON_ID} className={reasonCls}>
        面を選択
      </span>
    )}
    {ALIGNS.map((a) => (
      <button key={a.mode} type="button" className={buttonCls} disabled={blocked} aria-describedby={blocked ? ALIGN_REASON_ID : undefined} onClick={() => dispatch({ type: 'align', mode: a.mode })}>
        {a.label}
      </button>
    ))}
  </div>
);

const DistributeGroup = ({ dispatch, blocked }: GroupProps) => (
  <div className={groupCls}>
    <span className={tagCls}>Distribute</span>
    {blocked && (
      <span id={DISTRIBUTE_REASON_ID} className={reasonCls}>
        3面以上を選択
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

type Props = {
  dispatch: Dispatch<Action>;
  canUndo: boolean;
  canRedo: boolean;
  selectedCount: number;
  gridSize: number;
  overlayEnabled: boolean;
  onToggleOverlay: () => void;
  /** Slot for extra controls (import / export are mounted here). */
  children?: ReactNode;
};

export const Toolbar = ({ dispatch, canUndo, canRedo, selectedCount, gridSize, overlayEnabled, onToggleOverlay, children }: Props) => (
  <div className={`${rowCls} ${barCls}`}>
    <div className={groupCls}>
      <button type="button" className={buttonCls} disabled={!canUndo} onClick={() => dispatch({ type: 'undo' })}>
        Undo
      </button>
      <button type="button" className={buttonCls} disabled={!canRedo} onClick={() => dispatch({ type: 'redo' })}>
        Redo
      </button>
    </div>
    <AlignGroup dispatch={dispatch} blocked={selectedCount < 1} />
    <DistributeGroup dispatch={dispatch} blocked={selectedCount < 3} />
    <div className={groupCls}>
      <NumField label="Grid" value={gridSize} onCommit={(size) => dispatch({ type: 'setGrid', size })} />
      <button type="button" className={overlayEnabled ? buttonSolidCls : buttonCls} aria-pressed={overlayEnabled} onClick={onToggleOverlay}>
        Overlay
      </button>
    </div>
    {children}
  </div>
);
