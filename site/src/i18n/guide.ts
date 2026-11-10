/** `side` puts the screenshot beside its list; `wide` gives a strip the full row with the list below it. */
export type GuideLayout = 'side' | 'wide';

/** Each screenshot in `src/assets/guide/`: how many numbered callouts it carries (its list has as many items) and its row layout. */
export const GUIDE_SHOTS = {
  '01-1-dock-menu': { callouts: 1, layout: 'side' },
  '01-2-tools-websocket': { callouts: 1, layout: 'side' },
  '01-3-websocket-settings': { callouts: 3, layout: 'side' },
  '01-4-dock-connect': { callouts: 4, layout: 'wide' },
  '02-1-add-source': { callouts: 2, layout: 'side' },
  '02-2-source-properties': { callouts: 1, layout: 'side' },
  '02-3-dock-select-source': { callouts: 2, layout: 'wide' },
  '03-1-add-surface': { callouts: 4, layout: 'side' },
  '03-2-fit-corners': { callouts: 2, layout: 'side' },
  '04-1-import-export': { callouts: 2, layout: 'wide' },
} as const satisfies Record<string, { callouts: number; layout: GuideLayout }>;

export type GuideImage = keyof typeof GUIDE_SHOTS;

/** One screenshot and the operations its callouts point at; `items[i]` explains callout i + 1. */
export type GuideRow = { image: GuideImage; alt: string; where: string; title: string; items: readonly string[] };
