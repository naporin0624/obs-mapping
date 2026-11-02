// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from '.';

afterEach(cleanup);

describe('icons', () => {
  it.each([
    ['EyeIcon', EyeIcon],
    ['EyeOffIcon', EyeOffIcon],
    ['PlusIcon', PlusIcon],
    ['TrashIcon', TrashIcon],
  ])('%s is a decorative svg', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
  });
});
