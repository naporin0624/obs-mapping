import { css } from '../../../styled-system/css';

export const heroCls = css({ position: 'relative' });
export const videoCls = css({ display: 'block', width: '100%', height: 'auto', background: 'bg.emphasis' });
export const toggleCls = css({
  position: 'absolute',
  right: '8px',
  bottom: '8px',
  display: 'grid',
  placeItems: 'center',
  minWidth: 'target-min',
  minHeight: 'target-min',
  padding: '6px',
  border: '{borderWidths.default} solid {colors.border.default}',
  background: 'bg.canvas',
  color: 'fg.default',
  _hover: { background: 'bg.muted', color: 'fg.default' },
  '& svg': { display: 'block', width: '16px', height: '16px', fill: 'currentColor' },
});
export const visuallyHiddenCls = css({ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' });
