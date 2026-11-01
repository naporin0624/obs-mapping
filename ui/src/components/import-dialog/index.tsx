import { useEffect, useRef } from 'react';
import type { Canvas } from '../../io/import';
import { buttonCls, buttonSolidCls } from '../styles.css';
import { dialogCls, titleCls, resCls, textCls, actionsCls } from './styles.css';

type Props = {
  json: Canvas;
  current: Canvas;
  onScale: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
};

const size = (c: Canvas): string => `${c.width}×${c.height}`;

/** Modal for a resolution mismatch. Uses a native <dialog>: focus is trapped and Escape cancels. */
export const ImportDialog = ({ json, current, onScale, onOverwrite, onCancel }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d !== null && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={dialogCls}
      aria-labelledby="import-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <div id="import-dialog-title" className={titleCls}>
        解像度が違います
      </div>
      <div className={resCls}>
        JSON: {size(json)} / 現在: {size(current)}
      </div>
      <div className={textCls}>Scale: 点を比率で伸縮して現在の解像度に合わせます。</div>
      <div className={textCls}>Overwrite: JSON の解像度のまま上書きします。</div>
      <div className={textCls}>読み込みは元に戻せません（Undo の履歴も消えます）。</div>
      <div className={actionsCls}>
        <button type="button" className={buttonCls} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={buttonCls} onClick={onOverwrite}>
          Overwrite
        </button>
        <button type="button" className={buttonSolidCls} onClick={onScale} autoFocus>
          Scale
        </button>
      </div>
    </dialog>
  );
};
