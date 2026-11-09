import { css } from '../../../styled-system/css';
import { buttonCls, buttonSolidCls } from '../styles.css';

const iconLayoutCls = css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 'target-min', px: '1.5' });

export const wrapCls = css({ display: 'inline-flex' });
export const iconBtnCls = `${buttonCls} ${iconLayoutCls}`;
export const iconBtnSolidCls = `${buttonSolidCls} ${iconLayoutCls}`;
export const iconToggleCls = `${iconBtnCls} ${css({
  '&[data-selected]': { bg: 'accent.solid', color: 'fg.on-solid', borderColor: 'accent.solid' },
  '&[data-selected]:hover:not([data-disabled])': { bg: 'accent.solid-hover', borderColor: 'accent.solid-hover' },
  '@media (forced-colors: active)': { '&[data-selected]': { forcedColorAdjust: 'none', bg: 'Highlight', color: 'HighlightText', borderColor: 'Highlight' } },
})}`;
