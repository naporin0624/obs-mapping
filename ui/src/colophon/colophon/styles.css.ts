import { css } from '../../../styled-system/css';

export const pageCls = css({ display: 'flex', flexDirection: 'column', gap: '6', p: '6', maxWidth: '480px' });
export const headingCls = css({ fontFamily: 'mono', fontWeight: 700, fontSize: '16px' });
export const caseCls = css({ display: 'flex', flexDirection: 'column', gap: '2' });
export const captionCls = css({ color: 'fg.muted' });
export const linkCls = css({ color: 'accent.text', textDecoration: 'underline' });
export const frameCls = css({
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 9',
  bg: 'bg.canvas',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.default',
  overflow: 'hidden',
});
