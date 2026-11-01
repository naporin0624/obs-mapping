import { css } from '../../../styled-system/css';

export const outlineCls = css({ fill: 'transparent', stroke: 'accent.solid', strokeWidth: '1px', cursor: 'move' });
export const selectedCls = css({ strokeWidth: '2px' });
export const hiddenCls = css({ stroke: 'border.default', strokeDasharray: '4 4' });
export const warnCls = css({ stroke: 'danger.text', strokeDasharray: '6 4', strokeWidth: '2px' });
export const handleCls = css({ fill: 'bg.canvas', stroke: 'accent.solid', strokeWidth: '1px', cursor: 'crosshair' });
export const handleOnCls = css({ fill: 'accent.solid' });
export const gridLineCls = css({ stroke: 'border.subtle', strokeWidth: '1px', opacity: 0.6 });
export const warnTextCls = css({ fill: 'danger.text', fontFamily: 'mono', fontWeight: 700, pointerEvents: 'none', paintOrder: 'stroke', stroke: 'bg.canvas', strokeWidth: '3px' });
export const guideLineCls = css({ stroke: 'accent.solid', strokeWidth: '1px', strokeDasharray: '6 4', opacity: 0.55 });
