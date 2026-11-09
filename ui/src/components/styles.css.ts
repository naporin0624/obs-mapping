import { css } from '../../styled-system/css';

// Cannelloni controls: square, 1px border, hover = stepped colour change, focus = marching-ants ring.
const gradient = 'linear-gradient(90deg, token(colors.border.focus) 50%, transparent 0)';
const gradientV = 'linear-gradient(0deg, token(colors.border.focus) 50%, transparent 0)';

export const focusRing = {
  position: 'relative',
  _focusVisible: {
    outline: 'none',
    _after: {
      content: '""',
      position: 'absolute',
      inset: '-3px',
      pointerEvents: 'none',
      backgroundImage: `${gradient}, ${gradient}, ${gradientV}, ${gradientV}`,
      backgroundRepeat: 'repeat-x, repeat-x, repeat-y, repeat-y',
      backgroundSize: '8px 1px, 8px 1px, 1px 8px, 1px 8px',
      backgroundPosition: '0 0, 0 100%, 0 0, 100% 0',
      animation: 'marching 0.6s linear infinite',
      _motionReduce: { animation: 'none' },
    },
  },
} as const;

const buttonBase = {
  ...focusRing,
  minHeight: 'target-min',
  px: '3',
  fontFamily: 'mono',
  fontWeight: 700,
  fontSize: '12px',
  borderWidth: 'default',
  borderStyle: 'solid',
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color',
  transitionDuration: '180ms',
  transitionTimingFunction: 'steps(3, end)',
  _motionReduce: { transitionProperty: 'none' },
  _disabled: { opacity: 'disabled', cursor: 'default' },
} as const;

export const buttonCls = css(buttonBase, { bg: 'transparent', color: 'fg.default', borderColor: 'border.default', '&:hover:not(:disabled, [data-disabled])': { bg: 'bg.emphasis' } });
export const buttonSolidCls = css(buttonBase, {
  bg: 'accent.solid',
  color: 'fg.on-solid',
  borderColor: 'accent.solid',
  '&:hover:not(:disabled, [data-disabled])': { bg: 'accent.solid-hover', borderColor: 'accent.solid-hover' },
});
export const buttonDangerCls = css(buttonBase, {
  bg: 'danger.solid',
  color: 'fg.on-danger',
  borderColor: 'danger.solid',
  '&:hover:not(:disabled, [data-disabled])': { bg: 'danger.solid-hover', borderColor: 'danger.solid-hover' },
});

export const inputCls = css({
  // pseudo-elements do not render on <input>, so the ring is a static dashed outline here
  _focusVisible: { outline: '1px dashed token(colors.border.focus)', outlineOffset: '3px' },
  bg: 'bg.subtle',
  color: 'fg.default',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.default',
  minHeight: 'target-min',
  px: '1.5',
  minWidth: 0,
  fontFamily: 'body',
  _disabled: { opacity: 'disabled' },
});

export const rowCls = css({ display: 'flex', alignItems: 'center', gap: '2', flexWrap: 'wrap' });

export const labelCls = css({ display: 'flex', alignItems: 'center', gap: '1.5', color: 'fg.muted', fontWeight: 700 });

export const barCls = css({ px: '2', py: '1.5', bg: 'bg.subtle', borderBottomWidth: 'default', borderBottomStyle: 'solid', borderBottomColor: 'border.subtle' });

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
