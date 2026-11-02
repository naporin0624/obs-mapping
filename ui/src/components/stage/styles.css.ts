import { css } from '../../../styled-system/css';
import { focusRing } from '../styles.css';

export const outerCls = css({ ...focusRing });
export const frameCls = css({
  position: 'relative',
  width: '100%',
  bg: 'bg.pasteboard',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.default',
  overflow: 'hidden',
  userSelect: 'none',
});
// outline instead of border so the inner box keeps exactly the canvas size the surfaces are scaled to
export const canvasCls = css({
  position: 'absolute',
  bg: 'bg.canvas',
  outlineWidth: 'default',
  outlineStyle: 'solid',
  outlineColor: 'border.default',
  overflow: 'hidden',
});
export const layerCls = css({ position: 'absolute', inset: 0, width: '100%', height: '100%' });
