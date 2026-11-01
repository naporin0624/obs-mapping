import { css } from '../../../styled-system/css';
import { focusRing } from '../styles.css';

export const labelCls = css({ color: 'fg.muted', fontWeight: 700 });
export const selectCls = css({ display: 'flex', alignItems: 'center', gap: '1.5', minWidth: 0 });
export const triggerCls = css(focusRing, {
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  flex: 1,
  minWidth: 0,
  minHeight: 'target-min',
  px: '1.5',
  bg: 'bg.subtle',
  color: 'fg.default',
  fontFamily: 'body',
  fontSize: '12px',
  textAlign: 'left',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.default',
  cursor: 'pointer',
  _disabled: { opacity: 'disabled', cursor: 'default' },
  '&[data-pressed]': { bg: 'bg.muted' },
});
export const valueCls = css({ flex: 1, minWidth: 0, display: 'flex', '&[data-placeholder]': { color: 'fg.muted' } });
export const chevronCls = css({ color: 'fg.muted', flexShrink: 0 });
export const popoverCls = css({
  width: 'var(--trigger-width)',
  bg: 'bg.subtle',
  color: 'fg.default',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.default',
});
export const listCls = css({ maxHeight: '240px', overflowY: 'auto', outline: 'none' });
export const itemCls = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: 'target-min',
  px: '1.5',
  cursor: 'pointer',
  outline: 'none',
  '&[data-hovered], &[data-focused]': { bg: 'bg.emphasis' },
  '&[data-selected]': { boxShadow: 'inset 3px 0 0 token(colors.accent.solid)' },
});
export const rowCls = css({ display: 'flex', alignItems: 'baseline', gap: '3', width: '100%', minWidth: 0 });
export const nameCls = css({ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
export const detailCls = css({ flexShrink: 0, whiteSpace: 'nowrap', color: 'fg.muted', fontSize: '11px' });
