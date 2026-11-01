// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { surf } from '../../geometry/fixtures';
import { StageSurface } from '.';

const draw = (visible: boolean) => render(<StageSurface surface={surf('a', 10, 10, 100, 80)} image="data:image/jpeg;base64,AA" scale={1} visible={visible} />);

describe('StageSurface', () => {
  afterEach(cleanup);

  it('draws nothing when it is not visible', () => {
    expect(draw(false).container.firstChild).toBeNull();
  });

  it('draws the warped image when visible', () => {
    expect(draw(true).container.querySelector('img')).not.toBeNull();
  });
});
