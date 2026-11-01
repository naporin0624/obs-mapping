import { css } from '../../styled-system/css';

/** Shared control styles for the dock. */
export const buttonCls = css({
  bg: 'bg.raised',
  color: 'text.base',
  border: '1px solid token(colors.line)',
  borderRadius: '4px',
  px: '8px',
  py: '3px',
  cursor: 'pointer',
  _hover: { borderColor: 'accent' },
  _disabled: { opacity: 0.4, cursor: 'default', borderColor: 'line' },
  _focusVisible: { outline: '1px solid token(colors.accent)' },
});

export const buttonActiveCls = css({ borderColor: 'accent', color: 'accent' });

export const inputCls = css({
  bg: 'bg.input',
  color: 'text.base',
  border: '1px solid token(colors.line)',
  borderRadius: '4px',
  px: '6px',
  py: '3px',
  minWidth: 0,
  _focus: { outline: 'none', borderColor: 'accent' },
  _disabled: { opacity: 0.5 },
});

export const rowCls = css({ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' });

export const labelCls = css({ display: 'flex', alignItems: 'center', gap: '6px', color: 'text.dim' });
