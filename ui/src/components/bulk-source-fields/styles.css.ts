import { css } from '../../../styled-system/css';

export const panelCls = css({ display: 'flex', flexDirection: 'column', gap: '2' });
export const listCls = css({ display: 'flex', flexDirection: 'column', gap: '1', m: 0, p: 0, listStyle: 'none' });
export const itemCls = css({ display: 'flex', alignItems: 'baseline', gap: '3', minWidth: 0 });
export const nameCls = css({ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'fg.default' });
export const sourceCls = css({ flexShrink: 1, minWidth: 0, maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'mono', color: 'fg.muted' });
