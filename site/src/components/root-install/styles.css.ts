import { css } from '../../../styled-system/css';

export const warningsCls = css({
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  gap: '4px 16px',
  margin: '8px 0 0',
  '& dt': { fontWeight: 700 },
  '& dd': { margin: 0, gridColumn: 2 },
});
