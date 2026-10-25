export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Point, Size {}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const RESIZE_HANDLES: readonly ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export interface RectConstraints {
  readonly min: Size;
  readonly bounds: Size;
}

/** Clamps `value` into [lo, hi]. If the range is empty, `lo` wins. */
export function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(value, hi));
}

export function translateRect(rect: Rect, delta: Point, bounds: Size): Rect {
  return {
    ...rect,
    x: clamp(rect.x + delta.x, 0, bounds.width - rect.width),
    y: clamp(rect.y + delta.y, 0, bounds.height - rect.height),
  };
}

/**
 * Resizes a rect by dragging one of its edges or corners. The opposite edge
 * stays anchored, size never drops below `min` and the rect stays in `bounds`.
 */
export function resizeRect(
  rect: Rect,
  handle: ResizeHandle,
  delta: Point,
  { min, bounds }: RectConstraints,
): Rect {
  let { x, y, width, height } = rect;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  if (handle.includes('e')) {
    width = clamp(rect.width + delta.x, min.width, bounds.width - rect.x);
  } else if (handle.includes('w')) {
    width = clamp(rect.width - delta.x, min.width, right);
    x = right - width;
  }

  if (handle.includes('s')) {
    height = clamp(rect.height + delta.y, min.height, bounds.height - rect.y);
  } else if (handle.includes('n')) {
    height = clamp(rect.height - delta.y, min.height, bottom);
    y = bottom - height;
  }

  return { x, y, width, height };
}

/** Normalised rect spanned by two points, in whichever direction they were dragged. */
export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/** Grows a rect to at least `min`, then fits it inside `bounds`. */
export function fitRect(rect: Rect, { min, bounds }: RectConstraints): Rect {
  const width = clamp(Math.max(rect.width, min.width), 0, bounds.width);
  const height = clamp(Math.max(rect.height, min.height), 0, bounds.height);
  return {
    width,
    height,
    x: clamp(rect.x, 0, bounds.width - width),
    y: clamp(rect.y, 0, bounds.height - height),
  };
}

export function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
