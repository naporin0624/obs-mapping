import { css } from '../../../styled-system/css';

export const treeCls = css({ display: 'flex', flexDirection: 'column', gap: '1', outline: 'none' });
export const rowCls = css({
  display: 'flex',
  alignItems: 'center',
  gap: '1',
  minHeight: 'target-min',
  pl: '1.5',
  pr: '1.5',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.default',
  color: 'fg.default',
  cursor: 'pointer',
  outline: 'none',
  '&[data-selected]': { bg: 'bg.emphasis', outline: '1px solid token(colors.accent.solid)', outlineOffset: '-3px' },
  '&[data-focus-visible]': { outline: '2px solid token(colors.border.focus)', outlineOffset: '-2px' },
  '&[data-drop-target]': { borderColor: 'accent.border' },
  '&[data-dimmed=true]': { color: 'fg.subtle' },
});
export const chevronCls = css({
  width: 'target-min',
  height: 'target-min',
  flexShrink: 0,
  bg: 'transparent',
  color: 'inherit',
  borderWidth: 'none',
  cursor: 'pointer',
  '&[data-focus-visible]': { outline: '2px solid token(colors.border.focus)' },
});
export const dragHandleCls = css({
  width: 'target-min',
  height: 'target-min',
  flexShrink: 0,
  bg: 'transparent',
  color: 'fg.subtle',
  borderWidth: 'none',
  cursor: 'grab',
  '& + *': { ml: 'calc(var(--tree-item-level, 1) * 12px - 12px)' },
  '&[data-focus-visible]': { outline: '2px solid token(colors.border.focus)', outlineOffset: '-2px' },
});
export const eyeButtonCls = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'target-min',
  height: 'target-min',
  flexShrink: 0,
  bg: 'transparent',
  color: 'inherit',
  borderWidth: 'none',
  cursor: 'pointer',
  '&[data-focus-visible]': { outline: '2px solid token(colors.border.focus)', outlineOffset: '-2px' },
});
export const chevronSpacerCls = css({ width: 'target-min', flexShrink: 0 });
export const nameCls = css({ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
export const metaCls = css({ color: 'fg.subtle', fontSize: '11px', maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
export const dropLineCls = css({ height: '2px', bg: 'accent.solid', listStyle: 'none', '&[data-drop-target=false]': { display: 'none' } });
