import { describe, expect, it } from 'vitest';
import { quadWarning } from './quad';

describe('quadWarning', () => {
  it('square is fine', () => {
    expect(
      quadWarning([
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ]),
    ).toBeNull();
  });
  it('perspective trapezoid is fine', () => {
    expect(
      quadWarning([
        [10, 0],
        [90, 0],
        [100, 50],
        [0, 50],
      ]),
    ).toBeNull();
  });
  it('three collinear points are degenerate', () => {
    expect(
      quadWarning([
        [0, 0],
        [50, 0],
        [100, 0],
        [0, 100],
      ]),
    ).toBe('degenerate');
  });
  it('all points identical or on a line are degenerate', () => {
    expect(
      quadWarning([
        [1, 1],
        [1, 1],
        [1, 1],
        [1, 1],
      ]),
    ).toBe('degenerate');
    expect(
      quadWarning([
        [0, 0],
        [10, 10],
        [20, 20],
        [30, 30],
      ]),
    ).toBe('degenerate');
  });
  it('concave quad is not_convex', () => {
    expect(
      quadWarning([
        [0, 0],
        [100, 0],
        [20, 20],
        [0, 100],
      ]),
    ).toBe('not_convex');
  });
  it('bow-tie is not_convex', () => {
    expect(
      quadWarning([
        [0, 0],
        [100, 0],
        [10, 100],
        [90, 110],
      ]),
    ).toBe('not_convex');
  });
});
