import { css } from '../../../styled-system/css';
import { focusRing } from '../styles.css';

export const outerCls = css({ ...focusRing });
export const frameCls = css({
  position: 'relative',
  width: '100%',
  bg: 'bg.canvas',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.default',
  overflow: 'hidden',
  userSelect: 'none',
});
export const layerCls = css({ position: 'absolute', inset: 0, width: '100%', height: '100%' });
