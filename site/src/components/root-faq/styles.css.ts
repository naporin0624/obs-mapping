import { css } from '../../../styled-system/css';

export const groupCls = css({
  '& + &': { marginTop: '32px' },
  '& h3': { margin: '0 0 8px', fontSize: '1.125rem', lineHeight: '1.5' },
});
export const itemCls = css({
  borderTop: '{borderWidths.default} solid {colors.border.subtle}',
  '&:last-child': { borderBottom: '{borderWidths.default} solid {colors.border.subtle}' },
  '& > summary': {
    display: 'list-item',
    minHeight: 'target-min',
    paddingBlock: '8px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  '& > summary::marker': { color: 'fg.muted' },
  '& > summary:focus-visible': { outline: '{borderWidths.strong} solid {colors.border.focus}', outlineOffset: '2px' },
  '&:target > summary': { textDecoration: 'underline' },
});
export const answerCls = css({
  display: 'grid',
  gap: '8px',
  padding: '0 0 16px 1.5em',
  '& p': { margin: 0 },
});
export const linksCls = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0 24px',
  '& a': { display: 'inline-flex', alignItems: 'center', minHeight: 'target-min' },
});
