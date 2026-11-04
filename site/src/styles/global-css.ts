import { defineGlobalStyles } from '@pandacss/dev';

const DEMO_VIEWER_BODY = 'body:has([data-demo-viewer])';

const button = {
  minHeight: 'target-min',
  padding: '8px 16px',
  border: '{borderWidths.default} solid {colors.accent.border}',
  background: 'accent.solid',
  color: 'fg.on-solid',
  font: 'inherit',
  textDecoration: 'none',
  cursor: 'pointer',
  _hover: { background: 'accent.solid-hover', color: 'fg.on-solid' },
};

const WIDE = '@media (width >= 900px)';

// On wide screens the demo viewer fills the viewport instead of scrolling the page.
const fullHeightViewer = {
  [DEMO_VIEWER_BODY]: { [WIDE]: { display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', height: '100dvh', overflow: 'hidden' } },
  [`${DEMO_VIEWER_BODY} > main`]: { [WIDE]: { minHeight: 0 } },
};

export const globalCss = defineGlobalStyles({
  ':root': { colorScheme: 'dark' },
  '*, *::before, *::after': { boxSizing: 'border-box', borderRadius: 'none' },
  'html, body': { margin: 0, background: 'bg.canvas', color: 'fg.default', fontFamily: 'body', lineHeight: '1.7' },
  a: { color: 'accent.text', _hover: { color: 'accent.solid-hover' } },
  ':focus-visible': { outline: '{borderWidths.strong} solid {colors.border.focus}', outlineOffset: '2px' },
  'button, .button': button,
  'button:disabled': { opacity: 'disabled', cursor: 'not-allowed' },
  code: { fontFamily: 'mono', background: 'bg.muted', padding: '0 4px' },
  '[hidden]': { display: 'none !important' },
  ...fullHeightViewer,
});
