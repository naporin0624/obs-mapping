import { css } from '../../../styled-system/css';

// Narrow: a full-bleed bar stuck to the top. Two columns: a sticky column that scrolls on its own when taller than the viewport.
export const asideCls = css({
  position: 'sticky',
  top: 0,
  zIndex: 5,
  margin: '24px -16px 0',
  borderBlock: '{borderWidths.default} solid {colors.border.subtle}',
  background: 'bg.canvas',
  twoColumn: {
    top: '24px',
    maxHeight: 'calc(100dvh - 48px)',
    margin: 0,
    padding: '4px',
    overflowY: 'auto',
    border: 'none',
    borderLeft: '{borderWidths.default} solid {colors.border.subtle}',
    background: 'transparent',
  },
});
export const titleCls = css({
  display: 'none',
  twoColumn: { display: 'block', margin: '0 0 8px', paddingLeft: '14px', color: 'fg.muted', fontSize: '0.8125rem', fontWeight: 700 },
});
// Two columns always show the list: the closed <details> keeps its content rendered and drops its summary.
// Browsers without ::details-content keep the summary so the list can still be opened.
export const detailsCls = css({
  position: 'relative',
  '&[open] [data-chevron]': { transform: 'rotate(180deg)' },
  twoColumn: {
    position: 'static',
    '&::details-content': { contentVisibility: 'visible', blockSize: 'auto' },
    '@supports selector(::details-content)': { '& > summary': { display: 'none' } },
  },
});
export const summaryCls = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '44px',
  padding: '0 16px',
  color: 'fg.default',
  cursor: 'pointer',
  listStyle: 'none',
  '&::-webkit-details-marker': { display: 'none' },
  _hover: { color: 'accent.text' },
  _focusVisible: { outlineOffset: '-2px' },
});
export const currentCls = css({ minWidth: 0, overflow: 'hidden', fontWeight: 700, textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
export const chevronCls = css({ marginLeft: 'auto', color: 'fg.muted' });
// The current link is marked by weight and a bar as well as colour; its section link keeps the default colour.
export const listCls = css({
  position: 'absolute',
  top: '100%',
  insetInline: 0,
  maxHeight: 'calc(100dvh - 64px)',
  margin: 0,
  padding: '8px 0',
  overflowY: 'auto',
  listStyle: 'none',
  borderBlock: '{borderWidths.default} solid {colors.border.default}',
  background: 'bg.subtle',
  '& ol': { margin: 0, padding: 0, listStyle: 'none', counterReset: 'toc-step' },
  '& a': {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    minHeight: '40px',
    padding: '4px 16px 4px 14px',
    borderLeft: '{borderWidths.strong} solid transparent',
    color: 'fg.muted',
    lineHeight: '1.5',
    textDecoration: 'none',
    wordBreak: 'auto-phrase',
    _hover: { color: 'accent.text' },
    _focusVisible: { outlineOffset: '-2px' },
  },
  '& ol a': { alignItems: 'baseline', paddingLeft: '30px', counterIncrement: 'toc-step', _before: { content: 'counter(toc-step) "."', minWidth: '1.25em' } },
  '& li:has(> ol a[aria-current]) > a': { color: 'fg.default' },
  '& a[aria-current]': { borderLeftColor: 'accent.border', color: 'fg.default', fontWeight: 700 },
  twoColumn: {
    position: 'static',
    maxHeight: 'none',
    padding: 0,
    overflowY: 'visible',
    border: 'none',
    background: 'transparent',
    fontSize: '0.875rem',
    '& a': { minHeight: '32px' },
    '& ol a': { paddingLeft: '26px' },
  },
});
