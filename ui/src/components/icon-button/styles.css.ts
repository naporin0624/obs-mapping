import { css } from '../../../styled-system/css';
import { buttonCls } from '../styles.css';

export const wrapCls = css({ display: 'inline-flex' });
export const iconBtnCls = `${buttonCls} ${css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 'target-min', px: '1.5' })}`;
export const tooltipCls = css({
  bg: 'bg.emphasis',
  color: 'fg.default',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.strong',
  px: '2',
  py: '1',
  fontSize: '12px',
  zIndex: 10,
  pointerEvents: 'none',
});
