import { css } from '../../../styled-system/css';

export const popoverCls = css({
  width: 'min(280px, calc(100vw - 16px))',
  bg: 'bg.subtle',
  color: 'fg.default',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.strong',
});
export const dialogCls = css({ display: 'flex', flexDirection: 'column', gap: '2', p: '2', outline: 'none' });
export const titleCls = css({ m: 0, fontSize: '12px', fontWeight: 700 });
export const hintCls = css({ m: 0, color: 'fg.muted', fontSize: '11px' });
export const fieldsCls = css({ display: 'flex', flexWrap: 'wrap', gap: '2', '& input': { width: '56px' } });
export const previewCls = css({ position: 'relative', width: '100%', bg: 'bg.canvas', borderWidth: 'default', borderStyle: 'solid', borderColor: 'border.default' });
export const cellCls = css({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  fontSize: '11px',
  fontWeight: 700,
  borderWidth: 'default',
  borderStyle: 'dashed',
  borderColor: 'border.strong',
});
export const filledCellCls = `${cellCls} ${css({ bg: 'accent.solid', color: 'fg.on-solid', borderStyle: 'solid', borderColor: 'bg.canvas' })}`;
export const noteCls = css({ m: 0, color: 'fg.muted', fontSize: '11px' });
export const actionsCls = css({ display: 'flex', justifyContent: 'flex-end' });
