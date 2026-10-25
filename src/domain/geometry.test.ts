import { describe, expect, it } from 'vitest';
import { fitRect, rectFromPoints, resizeRect, translateRect } from './geometry';

const bounds = { width: 1000, height: 800 };
const min = { width: 100, height: 80 };
const rect = { x: 200, y: 200, width: 200, height: 150 };

describe('translateRect', () => {
  it('moves by the delta', () => {
    expect(translateRect(rect, { x: 30, y: -20 }, bounds)).toEqual({ ...rect, x: 230, y: 180 });
  });

  it('keeps the rect inside the bounds', () => {
    expect(translateRect(rect, { x: -500, y: 5000 }, bounds)).toEqual({ ...rect, x: 0, y: 650 });
  });
});

describe('resizeRect', () => {
  it('grows from the south-east corner without moving the origin', () => {
    expect(resizeRect(rect, 'se', { x: 50, y: 40 }, { min, bounds })).toEqual({
      x: 200, y: 200, width: 250, height: 190,
    });
  });

  it('anchors the opposite edge when dragging north-west', () => {
    expect(resizeRect(rect, 'nw', { x: -50, y: -30 }, { min, bounds })).toEqual({
      x: 150, y: 170, width: 250, height: 180,
    });
  });

  it('respects the minimum size', () => {
    expect(resizeRect(rect, 'w', { x: 500, y: 0 }, { min, bounds })).toEqual({
      ...rect, x: 300, width: 100,
    });
  });

  it('stops at the bounds', () => {
    expect(resizeRect(rect, 'n', { x: 0, y: -1000 }, { min, bounds })).toEqual({
      ...rect, y: 0, height: 350,
    });
    expect(resizeRect(rect, 'e', { x: 5000, y: 0 }, { min, bounds }).width).toBe(800);
  });

  it('ignores the axis a side handle does not control', () => {
    expect(resizeRect(rect, 's', { x: 999, y: 10 }, { min, bounds })).toEqual({ ...rect, height: 160 });
  });
});

describe('rectFromPoints', () => {
  it('normalises a drag in any direction', () => {
    expect(rectFromPoints({ x: 300, y: 300 }, { x: 100, y: 250 })).toEqual({
      x: 100, y: 250, width: 200, height: 50,
    });
  });
});

describe('fitRect', () => {
  it('enforces the minimum size and keeps the rect on the board', () => {
    expect(fitRect({ x: 980, y: -10, width: 20, height: 20 }, { min, bounds })).toEqual({
      x: 900, y: 0, width: 100, height: 80,
    });
  });
});
