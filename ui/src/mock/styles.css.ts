import { css } from '../../styled-system/css';

export const debugCls = css({ display: 'flex', flexDirection: 'column', gap: '2', p: '2', borderTopWidth: 'default', borderTopStyle: 'solid', borderTopColor: 'border.subtle' });
export const debugTitleCls = css({ fontSize: '12px', fontWeight: 700, color: 'fg.muted' });
export const logPanelCls = css({ display: 'flex', flexDirection: 'column', gap: '1', p: '2', borderWidth: 'default', borderStyle: 'solid', borderColor: 'border.default', bg: 'bg.subtle' });
export const logCls = css({ m: 0, minHeight: '6', fontFamily: 'mono', fontSize: '12px', whiteSpace: 'pre-wrap' });
