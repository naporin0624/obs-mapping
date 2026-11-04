import { describe, expect, it } from 'vitest';
import { createProjectorCamera, projectToCanvas } from './projector';
import type { Projector, Vec3 } from './spec';

const projector: Projector = { position: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], fovY: 50 };

describe('projectToCanvas', () => {
  it('projects the target to the canvas center', () => {
    const [x, y] = projectToCanvas(createProjectorCamera(projector), projector.target);
    expect(x).toBeCloseTo(960, 6);
    expect(y).toBeCloseTo(540, 6);
  });

  it('puts points above the target at smaller y', () => {
    const [, y] = projectToCanvas(createProjectorCamera(projector), [0, 0.5, 0]);
    expect(y).toBeLessThan(540);
  });

  it('projects the frustum top-right direction to [1920, 0]', () => {
    const halfH = Math.tan((projector.fovY * Math.PI) / 360) * 5;
    const point: Vec3 = [halfH * (16 / 9), halfH, 0];
    const [x, y] = projectToCanvas(createProjectorCamera(projector), point);
    expect(x).toBeCloseTo(1920, 6);
    expect(y).toBeCloseTo(0, 6);
  });
});
