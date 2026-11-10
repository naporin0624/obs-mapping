import { css } from '../../../styled-system/css';

// Two columns: the 48rem reading column on the left and the contents nav beside it from the top of the page.
export const rootCls = css({
  maxWidth: '48rem',
  margin: '0 auto',
  padding: '24px 16px 64px',
  '& h1': { margin: '24px 0 0', fontSize: '2.5rem', lineHeight: '1.3' },
  '& h2': { margin: '0 0 16px', paddingTop: '16px', borderTop: '{borderWidths.default} solid {colors.border.subtle}', fontSize: '1.5rem', lineHeight: '1.4' },
  // Clears the sticky contents bar on narrow screens.
  '& [id]': { scrollMarginTop: '64px', twoColumn: { scrollMarginTop: '24px' } },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 48rem) 14rem',
    gridTemplateRows: 'auto 1fr',
    columnGap: '32px',
    maxWidth: 'calc(62rem + 64px)',
  },
});
export const introCls = css({ twoColumn: { gridColumn: 1, gridRow: 1 } });
export const bodyCls = css({ twoColumn: { gridColumn: 1, gridRow: 2 } });
export const tocSlotCls = css({ twoColumn: { gridColumn: 2, gridRow: '1 / 3', alignSelf: 'start' } });
export const leadCls = css({ margin: '8px 0 0', color: 'fg.muted', fontSize: '1.125rem' });
export const actionsCls = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '16px 24px',
  margin: '24px 0 0',
  '& a': { display: 'inline-flex', alignItems: 'center', minHeight: 'target-min' },
});
export const sectionCls = css({ marginTop: '56px' });
export const bulletsCls = css({ display: 'grid', gap: '8px', margin: 0, paddingLeft: '1.5em' });
export const linksCls = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px 24px',
  margin: '16px 0 0',
  '& a': { display: 'inline-flex', alignItems: 'center', minHeight: 'target-min' },
});
