import { css } from '../../../styled-system/css';

export const fieldsetCls = css({ display: 'flex', alignItems: 'center', gap: '1.5', border: 'none', m: 0, p: 0, minWidth: 0 });
export const legendCls = css({ float: 'left', p: 0, mr: '1.5', color: 'fg.muted', fontWeight: 700 });
export const segmentsCls = css({ display: 'inline-flex' });

export const segmentCls = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 'target-min',
  px: '3',
  cursor: 'pointer',
  fontFamily: 'mono',
  fontWeight: 700,
  color: 'fg.default',
  bg: 'transparent',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.strong',
  '&:not(:first-child)': { marginInlineStart: '-1px' },
  '&:has(input:checked)': { bg: 'accent.solid', color: 'fg.on-solid', borderColor: 'accent.solid', zIndex: 1 },
  '@media (forced-colors: active)': { '&:has(input:checked)': { forcedColorAdjust: 'none', bg: 'Highlight', color: 'HighlightText', borderColor: 'Highlight' } },
  '&:has(input:focus-visible)': { outline: '2px solid token(colors.border.focus)', outlineOffset: '2px', zIndex: 2 },
});

export const radioCls = css({ position: 'absolute', opacity: 0, inset: 0, width: '100%', height: '100%', m: 0, cursor: 'pointer' });
