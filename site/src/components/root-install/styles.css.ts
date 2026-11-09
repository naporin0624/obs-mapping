import { css } from '../../../styled-system/css';

export const listCls = css({
  display: 'grid',
  gap: '24px',
  margin: 0,
  paddingLeft: '1.5em',
  '& h3': { margin: 0, fontSize: '1.125rem', lineHeight: '1.5' },
  '& p': { margin: '4px 0 0' },
  '& li::marker': { color: 'fg.muted', fontWeight: 700 },
  '& li:target h3': { textDecoration: 'underline' },
});
export const warningsCls = css({
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  gap: '4px 16px',
  margin: '8px 0 0',
  '& dt': { fontWeight: 700 },
  '& dd': { margin: 0, gridColumn: 2 },
});
