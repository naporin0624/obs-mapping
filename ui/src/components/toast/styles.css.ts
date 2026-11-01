import { css } from '../../../styled-system/css';

export const toastCls = css({
  position: 'fixed',
  top: '2',
  right: '2',
  maxWidth: '360px',
  bg: 'bg.canvas',
  color: 'fg.default',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'danger.solid',
  px: '3',
  py: '2',
  cursor: 'pointer',
  zIndex: 10,
});
export const titleCls = css({ fontWeight: 700, fontSize: '12px', color: 'danger.text' });
