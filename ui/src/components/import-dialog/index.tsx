import { useEffect, useRef } from 'react';
import { useT } from '../../i18n/use-t';
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
  const t = useT();
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
        {t.importTitle}
      </div>
      <div className={resCls}>{t.importResolution(size(json), size(current))}</div>
      <div className={textCls}>{t.importScaleHelp}</div>
      <div className={textCls}>{t.importOverwriteHelp}</div>
      <div className={textCls}>{t.importUndoHelp}</div>
      <div className={actionsCls}>
        <button type="button" className={buttonCls} onClick={onCancel}>
          {t.importCancel}
        </button>
        <button type="button" className={buttonCls} onClick={onOverwrite}>
          {t.importOverwrite}
        </button>
        <button type="button" className={buttonSolidCls} onClick={onScale} autoFocus>
          {t.importScale}
        </button>
      </div>
    </dialog>
  );
};
