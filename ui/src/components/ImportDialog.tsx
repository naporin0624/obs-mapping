import { useEffect, useRef } from 'react';
import { css } from '../../styled-system/css';
import type { Canvas } from '../io/import';
import { buttonCls, buttonSolidCls } from './styles';

const dialogCls = css({
  bg: 'bg.canvas',
  color: 'fg.default',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.default',
  borderRadius: 0,
  p: '5',
  maxWidth: '32rem',
  m: 'auto',
  '&::backdrop': { bg: 'rgba(0, 0, 0, 0.6)' },
});
const titleCls = css({ fontWeight: 700, fontSize: '14px', mb: '3' });
const resCls = css({ fontFamily: 'mono', fontWeight: 700, mb: '3' });
const textCls = css({ color: 'fg.muted', mb: '2', lineHeight: 1.6 });
const actionsCls = css({ display: 'flex', gap: '2', justifyContent: 'flex-end', mt: '4', flexWrap: 'wrap' });

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
