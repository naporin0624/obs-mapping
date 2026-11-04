import type { Mask, Point } from '../model/mapping';
import type { Bounds } from './rect';

const crosses = (p: Point, a: Point, b: Point): boolean => a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0];

export const polygonContains = (points: readonly Point[], p: Point): boolean => points.filter((a, i) => crosses(p, a, points[(i + 1) % points.length] ?? a)).length % 2 === 1;

export const maskContains = (mask: Mask, unit: Point): boolean => {
  switch (mask.type) {
    case 'ellipse': {
      const rx = mask.width / 2;
      const ry = mask.height / 2;
      return ((unit[0] - (mask.x + rx)) / rx) ** 2 + ((unit[1] - (mask.y + ry)) / ry) ** 2 <= 1;
    }
    case 'polygon':
      return polygonContains(mask.points, unit);
  }
};

export const maskOutline = (mask: Mask, ellipseSegments: number): readonly Point[] => {
  switch (mask.type) {
    case 'ellipse': {
      const rx = mask.width / 2;
      const ry = mask.height / 2;
      const n = Math.max(0, Math.floor(ellipseSegments));
      return Array.from({ length: n }, (_, k): Point => [mask.x + rx + rx * Math.cos((2 * Math.PI * k) / n), mask.y + ry + ry * Math.sin((2 * Math.PI * k) / n)]);
    }
    case 'polygon':
      return mask.points;
  }
};

const px = (n: number): string => `${String(n)}px`;

// Unit-space mask scaled into a w x h element, as a CSS clip-path value.
export const maskClipPath = (mask: Mask, w: number, h: number): string => {
  const scaled = maskToPx(mask, { x: 0, y: 0, width: w, height: h });
  switch (scaled.type) {
    case 'ellipse':
      return `ellipse(${px(scaled.width / 2)} ${px(scaled.height / 2)} at ${px(scaled.x + scaled.width / 2)} ${px(scaled.y + scaled.height / 2)})`;
    case 'polygon':
      return `polygon(evenodd, ${scaled.points.map(([x, y]) => `${px(x)} ${px(y)}`).join(', ')})`;
  }
};

type Axis = (v: number) => number;

const mapMask = (mask: Mask, fx: Axis, fy: Axis): Mask => {
  switch (mask.type) {
    case 'ellipse':
      return { type: 'ellipse', x: fx(mask.x), y: fy(mask.y), width: fx(mask.width), height: fy(mask.height) };
    case 'polygon':
      return { type: 'polygon', points: mask.points.map(([x, y]): Point => [fx(x), fy(y)]) };
  }
};

// Px are relative to the surface's own top-left, so b.x / b.y are unused.
export const maskToPx = (mask: Mask, b: Bounds): Mask =>
  mapMask(
    mask,
    (v) => v * b.width,
    (v) => v * b.height,
  );

export const maskFromPx = (mask: Mask, b: Bounds): Mask =>
  mapMask(
    mask,
    (v) => v / b.width,
    (v) => v / b.height,
  );
