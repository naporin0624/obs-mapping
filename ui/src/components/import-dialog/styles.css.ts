import { css } from '../../../styled-system/css';

export const dialogCls = css({
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
export const titleCls = css({ fontWeight: 700, fontSize: '14px', mb: '3' });
export const resCls = css({ fontFamily: 'mono', fontWeight: 700, mb: '3' });
export const textCls = css({ color: 'fg.muted', mb: '2', lineHeight: 1.6 });
export const actionsCls = css({ display: 'flex', gap: '2', justifyContent: 'flex-end', mt: '4', flexWrap: 'wrap' });
