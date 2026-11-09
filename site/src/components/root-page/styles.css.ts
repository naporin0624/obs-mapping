import { css } from '../../../styled-system/css';

export const rootCls = css({
  maxWidth: '48rem',
  margin: '0 auto',
  padding: '24px 16px 64px',
  '& h1': { margin: '24px 0 0', fontSize: '2.5rem', lineHeight: '1.3' },
  '& h2': { margin: '0 0 16px', paddingTop: '16px', borderTop: '{borderWidths.default} solid {colors.border.subtle}', fontSize: '1.5rem', lineHeight: '1.4' },
});
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
