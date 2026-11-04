// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { surf, withMask } from '../../geometry/fixtures';
import { maskClipPath } from '../../geometry/mask';
import type { Mask } from '../../model/mapping';
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

const mask: Mask = { type: 'ellipse', x: 0.1, y: 0.2, width: 0.5, height: 0.6 };
const cropOf = (surface = surf('a', 0, 0, 100, 100)) => render(<StageSurface surface={surface} image="x.png" scale={1} visible />).container.querySelector('div');

describe('StageSurface mask', () => {
  it('clips the crop element with the mask in element px', () => {
    expect(cropOf(withMask(surf('a', 0, 0, 100, 100), mask))?.style.clipPath).toBe(maskClipPath(mask, 1000, 1000));
  });
  it('does not clip a surface without a mask', () => {
    expect(cropOf()?.style.clipPath).toBe('');
  });
});
