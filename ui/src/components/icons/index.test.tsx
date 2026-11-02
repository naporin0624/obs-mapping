// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AlignBottomIcon,
  AlignCenterHIcon,
  AlignCenterVIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  DistributeHIcon,
  DistributeVIcon,
  ExportIcon,
  EyeIcon,
  EyeOffIcon,
  GroupIcon,
  ImportIcon,
  PlusIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
  UngroupIcon,
} from '.';

afterEach(cleanup);

describe('icons', () => {
  it.each([
    ['EyeIcon', EyeIcon],
    ['EyeOffIcon', EyeOffIcon],
    ['PlusIcon', PlusIcon],
    ['TrashIcon', TrashIcon],
    ['UndoIcon', UndoIcon],
    ['RedoIcon', RedoIcon],
    ['AlignLeftIcon', AlignLeftIcon],
    ['AlignCenterHIcon', AlignCenterHIcon],
    ['AlignRightIcon', AlignRightIcon],
    ['AlignTopIcon', AlignTopIcon],
    ['AlignCenterVIcon', AlignCenterVIcon],
    ['AlignBottomIcon', AlignBottomIcon],
    ['DistributeHIcon', DistributeHIcon],
    ['DistributeVIcon', DistributeVIcon],
    ['GroupIcon', GroupIcon],
    ['UngroupIcon', UngroupIcon],
    ['ImportIcon', ImportIcon],
    ['ExportIcon', ExportIcon],
  ])('%s is a decorative svg', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 16 16');
  });
});
