import type { GuideLayout } from '../../i18n/guide';

export type MediaSide = 'start' | 'end';

const sidesBefore = (layouts: readonly GuideLayout[], index: number): number => layouts.slice(0, index).filter((layout) => layout === 'side').length;

/** Which side each side-by-side row puts its screenshot on; wide rows get none and do not break the alternation. */
export const mediaSides = (layouts: readonly GuideLayout[]): (MediaSide | undefined)[] =>
  layouts.map((layout, index) => {
    if (layout === 'wide') return undefined;
    return sidesBefore(layouts, index) % 2 === 0 ? 'start' : 'end';
  });
