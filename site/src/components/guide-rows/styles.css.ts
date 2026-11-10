import { css } from '../../../styled-system/css';

const ROOMY = '@container (width >= 640px)';

export const rowsCls = css({
  containerType: 'inline-size',
  display: 'grid',
  gap: '32px',
  margin: '16px 0 0',
  padding: 0,
  listStyle: 'none',
});
// Side rows on the `end` side put the screenshot on the right; the DOM keeps image before text for the stacked layout.
export const rowCls = css({
  display: 'grid',
  gap: '12px',
  [ROOMY]: {
    '&[data-guide-layout="side"]': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '24px', alignItems: 'start' },
    '&[data-guide-media-side="end"] > [data-guide-media]': { order: 2 },
  },
});
export const mediaCls = css({ display: 'grid', justifyItems: 'start' });
export const triggerCls = css({
  position: 'relative',
  display: 'block',
  maxWidth: '100%',
  minHeight: 'auto',
  padding: 0,
  border: '{borderWidths.default} solid {colors.border.subtle}',
  background: 'bg.pasteboard',
  color: 'fg.default',
  lineHeight: 0,
  cursor: 'zoom-in',
  _hover: { borderColor: 'accent.border', background: 'bg.pasteboard', color: 'fg.default' },
});
// The width attribute keeps it no wider than the file; the cap below keeps it no taller than 28rem.
// Sizing from the attributes, not the loaded file, reserves the box before the lazy image arrives.
export const thumbCls = css({ display: 'block', maxWidth: 'min(100%, calc(28rem * var(--thumb-ratio)))', height: 'auto' });
export const badgeCls = css({
  position: 'absolute',
  insetBlockStart: '4px',
  insetInlineEnd: '4px',
  display: 'grid',
  placeItems: 'center',
  width: '24px',
  height: '24px',
  border: '{borderWidths.default} solid {colors.border.default}',
  background: 'bg.canvas',
  '& svg': { width: '14px', height: '14px', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
});
export const textCls = css({ display: 'grid', gap: '8px', alignContent: 'start' });
export const headCls = css({
  margin: 0,
  '& h4': { margin: 0, fontSize: '1rem', lineHeight: '1.5' },
});
export const whereCls = css({ margin: 0, color: 'fg.muted', fontFamily: 'mono', fontSize: '0.8125rem', lineHeight: '1.5' });
// role="list" on the <ol> keeps it a list for Safari once its markers are replaced by these badges.
export const calloutsCls = css({
  display: 'grid',
  gap: '8px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
  counterReset: 'callout',
  '& > li': { display: 'grid', gridTemplateColumns: '1.5rem minmax(0, 1fr)', gap: '8px', counterIncrement: 'callout' },
  '& > li::before': {
    content: 'counter(callout)',
    display: 'grid',
    placeItems: 'center',
    width: '1.5rem',
    height: '1.5rem',
    marginTop: '0.1rem',
    borderRadius: 'pill',
    background: 'accent.solid',
    color: 'fg.on-solid',
    fontSize: '0.875rem',
    fontWeight: 700,
    lineHeight: 1,
  },
});
// Multi-column flow keeps the numbers reading top to bottom, then on to the next column.
export const wideCalloutsCls = css({
  [ROOMY]: { display: 'block', columns: 2, columnGap: '24px', '& > li': { breakInside: 'avoid', marginBottom: '8px' } },
});
export const dialogCls = css({
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100dvh - 32px)',
  padding: '8px',
  border: '{borderWidths.default} solid {colors.border.default}',
  background: 'bg.canvas',
  color: 'fg.default',
  '&[open]': { display: 'grid', gap: '8px', justifyItems: 'end' },
  '&::backdrop': { background: 'rgb(0 0 0 / 0.8)' },
  '& form': { margin: 0 },
});
export const fullCls = css({
  display: 'block',
  maxWidth: '100%',
  // Leaves room for the dialog's padding and its close button row.
  maxHeight: 'calc(100dvh - 120px)',
  width: 'auto',
  height: 'auto',
  justifySelf: 'center',
});
