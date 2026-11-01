import { css } from '../../../styled-system/css';

export const statusCls = css({
  fontSize: '11px',
  color: 'fg.muted',
  '&[data-kind=open]': { color: 'accent.text' },
  '&[data-kind=auth_failed]': { color: 'danger.text' },
});
