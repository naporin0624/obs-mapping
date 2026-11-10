import { css } from '../../styled-system/css';

// Child combinators keep the step styles off the screenshot rows nested in each step.
export const stepListCls = css({
  display: 'grid',
  gap: '32px',
  margin: 0,
  paddingLeft: '1.5em',
  '& > li > h3': { margin: 0, fontSize: '1.125rem', lineHeight: '1.5' },
  '& > li > p': { margin: '4px 0 0' },
  '& > li::marker': { color: 'fg.muted', fontWeight: 700 },
  '& > li:target > h3': { textDecoration: 'underline' },
  '& > li > ul + p': { marginTop: '16px' },
});
