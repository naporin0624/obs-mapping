import type { Dispatch, ReactNode } from 'react';
import type { AlignMode } from '../../geometry/align';
import type { Action } from '../../editor/reducer';
import { NumField } from '../field';
import { barCls, buttonCls, buttonSolidCls, rowCls } from '../styles.css';
import { tagCls, groupCls } from './styles.css';

const ALIGNS: readonly { mode: AlignMode; label: string }[] = [
  { mode: 'left', label: 'Left' },
  { mode: 'centerX', label: 'Center' },
  { mode: 'right', label: 'Right' },
  { mode: 'top', label: 'Top' },
  { mode: 'centerY', label: 'Middle' },
  { mode: 'bottom', label: 'Bottom' },
];

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
    <div className={groupCls}>
      <span className={tagCls}>Align</span>
      {ALIGNS.map((a) => (
        <button key={a.mode} type="button" className={buttonCls} disabled={selectedCount < 2} onClick={() => dispatch({ type: 'align', mode: a.mode })}>
          {a.label}
        </button>
      ))}
    </div>
    <div className={groupCls}>
      <span className={tagCls}>Distribute</span>
      <button type="button" className={buttonCls} disabled={selectedCount < 3} onClick={() => dispatch({ type: 'distribute', axis: 'x' })}>
        Horizontal
      </button>
      <button type="button" className={buttonCls} disabled={selectedCount < 3} onClick={() => dispatch({ type: 'distribute', axis: 'y' })}>
        Vertical
      </button>
    </div>
    <div className={groupCls}>
      <NumField label="Grid" value={gridSize} onCommit={(size) => dispatch({ type: 'setGrid', size })} />
      <button type="button" className={overlayEnabled ? buttonSolidCls : buttonCls} aria-pressed={overlayEnabled} onClick={onToggleOverlay}>
        Overlay
      </button>
    </div>
    {children}
  </div>
);
