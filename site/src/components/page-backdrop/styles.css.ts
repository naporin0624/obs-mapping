import { css } from '../../../styled-system/css';

// Minimum 4.5:1 for accent.text over the brightest possible thumbnail pixel needs >= 0.854 (see contrast.test.ts).
export const BACKDROP_ALPHA = 0.88;

export const backdropCls = css({
  position: 'fixed',
  inset: 0,
  zIndex: -1,
  pointerEvents: 'none',
  '& img': { display: 'block', width: '100%', height: '100%', objectFit: 'cover' },
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    background: `color-mix(in srgb, token(colors.bg.canvas) ${BACKDROP_ALPHA * 100}%, transparent)`,
  },
});
