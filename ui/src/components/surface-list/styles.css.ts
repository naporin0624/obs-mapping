import { css } from '../../../styled-system/css';

export const sectionCls = css({ display: 'flex', flexDirection: 'column', gap: '2', p: '2', borderBottomWidth: 'default', borderBottomStyle: 'solid', borderBottomColor: 'border.subtle' });
export const headingCls = css({ fontFamily: 'mono', fontWeight: 700, color: 'fg.muted' });
export const listCls = css({ display: 'flex', flexDirection: 'column', gap: '1', listStyle: 'none', m: 0, p: 0 });
export const itemCls = css({
  display: 'flex',
  alignItems: 'center',
  gap: '1',
  px: '1.5',
  minHeight: 'target-min',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.default',
  cursor: 'pointer',
  '&[aria-selected=true]': { bg: 'bg.emphasis', outline: '1px solid token(colors.accent.solid)', outlineOffset: '-3px' },
  '&[data-over=true]': { borderColor: 'accent.border' },
});
export const nameCls = css({ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
export const subCls = css({ color: 'fg.subtle', fontSize: '11px', maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
export const hintCls = css({ color: 'fg.muted' });
export const growCls = css({ flex: 1 });
