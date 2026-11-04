import * as THREE from 'three';

import { SOURCE_HEIGHT as H, SOURCE_WIDTH as W, type VideoSource } from './video-source';

const BACKDROP = 'oklch(0.16 0.02 260)';
const ACCENT = 'oklch(0.700 0.235 260)';
const WARM = 'oklch(0.75 0.19 25)';
const GRID_STEP = 120;
const TAU = Math.PI * 2;

type Style = Partial<CanvasFillStrokeStyles & CanvasPathDrawingStyles & CanvasTextDrawingStyles>;

const paint = (ctx: CanvasRenderingContext2D, style: Style): void => void Object.assign(ctx, style);

const steps = (limit: number): number[] => Array.from({ length: Math.floor(limit / GRID_STEP) + 1 }, (_, i) => i * GRID_STEP);

const line = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void => {
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
};

const drawSweep = (ctx: CanvasRenderingContext2D, seconds: number): void => {
  const shift = ((seconds * 0.25) % 1) * W;
  const gradient = ctx.createLinearGradient(-W + shift, 0, shift + W, H);
  gradient.addColorStop(0, BACKDROP);
  gradient.addColorStop(0.5, ACCENT);
  gradient.addColorStop(1, BACKDROP);
  paint(ctx, { fillStyle: gradient });
  ctx.fillRect(0, 0, W, H);
};

const drawGrid = (ctx: CanvasRenderingContext2D): void => {
  paint(ctx, { strokeStyle: 'rgba(255,255,255,0.55)', lineWidth: 3 });
  ctx.beginPath();
  for (const x of steps(W)) line(ctx, x, 0, x, H);
  for (const y of steps(H)) line(ctx, 0, y, W, y);
  ctx.stroke();
};

const drawOrbit = (ctx: CanvasRenderingContext2D, seconds: number): void => {
  const angle = seconds * 0.8;
  paint(ctx, { fillStyle: WARM });
  ctx.beginPath();
  ctx.arc(W / 2 + Math.cos(angle) * 520, H / 2 + Math.sin(angle) * 260, 90, 0, TAU);
  ctx.fill();
};

// Corner marks and the frame edge show exactly where a surface crop starts and ends.
const drawFrameMarks = (ctx: CanvasRenderingContext2D): void => {
  paint(ctx, { strokeStyle: 'white', lineWidth: 12 });
  ctx.strokeRect(6, 6, W - 12, H - 12);
  paint(ctx, { fillStyle: 'white', font: '700 96px system-ui, sans-serif', textBaseline: 'top' });
  ctx.fillText('TL', 36, 36);
  paint(ctx, { textAlign: 'right' });
  ctx.fillText('TR', W - 36, 36);
  paint(ctx, { textBaseline: 'bottom' });
  ctx.fillText('BR', W - 36, H - 36);
  paint(ctx, { textAlign: 'left' });
  ctx.fillText('BL', 36, H - 36);
};

const drawTimecode = (ctx: CanvasRenderingContext2D, seconds: number): void => {
  paint(ctx, { fillStyle: 'white', font: '700 140px ui-monospace, monospace', textAlign: 'center', textBaseline: 'middle' });
  ctx.fillText(seconds.toFixed(1).padStart(5, '0'), W / 2, H / 2);
};

export const createSampleSource = (): VideoSource => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('2D canvas is not available');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;

  return {
    texture,
    ready: () => true,
    update(timeMs) {
      const seconds = timeMs / 1000;
      drawSweep(ctx, seconds);
      drawGrid(ctx);
      drawOrbit(ctx, seconds);
      drawFrameMarks(ctx);
      drawTimecode(ctx, seconds);
      texture.needsUpdate = true;
    },
    stop() {
      texture.dispose();
    },
  };
};
