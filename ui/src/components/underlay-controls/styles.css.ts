import { css } from '../../../styled-system/css';

export const hiddenInputCls = css({ display: 'none' });
export const sliderCls = css({ display: 'flex', alignItems: 'center', gap: '1.5', color: 'fg.muted', fontWeight: 700 });
export const trackCls = css({
  position: 'relative',
  width: '120px',
  height: 'target-min',
  _before: { content: '""', position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', bg: 'border.strong' },
});
export const thumbCls = css({
  top: '50%',
  width: '12px',
  height: '16px',
  bg: 'accent.solid',
  cursor: 'pointer',
  _focusVisible: { outline: '1px dashed token(colors.border.focus)', outlineOffset: '3px' },
});
export const outputCls = css({ minWidth: '4ch', textAlign: 'right', color: 'fg.default', fontVariantNumeric: 'tabular-nums' });
