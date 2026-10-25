import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '../domain/geometry';

export interface DragSession {
  /** Called at most once per animation frame with the offset from the start point. */
  onMove(delta: Point, event: PointerEvent): void;
  onEnd(delta: Point, event: PointerEvent): void;
  /** Escape key, pointercancel, or unmount mid-drag. */
  onCancel(): void;
  /** Cursor shown everywhere for the duration of the drag. */
  readonly cursor?: string;
}

export type DragStart<E extends Element> = (event: ReactPointerEvent<E>) => DragSession | null;

/**
 * Generic pointer-drag primitive used for moving, resizing and drawing.
 * `start` decides whether a drag begins and returns its callbacks.
 * Listeners live on `window` so fast drags never "lose" the element.
 */
export function usePointerDrag<E extends Element>(
  start: DragStart<E>,
): (event: ReactPointerEvent<E>) => void {
  const startRef = useRef(start);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    startRef.current = start;
  });

  useEffect(() => () => stopRef.current?.(), []);

  return useCallback(
    (event: ReactPointerEvent<E>) => {
      if (event.button !== 0 || stopRef.current) return;
      const session = startRef.current(event);
      if (!session) return;
      event.preventDefault();

      const origin = { x: event.clientX, y: event.clientY };
      const deltaOf = (e: PointerEvent): Point => ({
        x: e.clientX - origin.x,
        y: e.clientY - origin.y,
      });
      let frame = 0;
      let lastMove: PointerEvent | null = null;

      const flushMove = () => {
        frame = 0;
        if (lastMove) session.onMove(deltaOf(lastMove), lastMove);
      };
      const onPointerMove = (e: PointerEvent) => {
        if (e.pointerId !== event.pointerId) return;
        lastMove = e;
        if (!frame) frame = requestAnimationFrame(flushMove);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (e.pointerId !== event.pointerId) return;
        stop();
        session.onEnd(deltaOf(e), e);
      };
      const onCancel = () => {
        stop();
        session.onCancel();
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
      };

      const root = document.documentElement;
      function stop() {
        cancelAnimationFrame(frame);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKeyDown);
        root.classList.remove('is-dragging');
        root.style.removeProperty('--drag-cursor');
        stopRef.current = null;
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKeyDown);
      root.classList.add('is-dragging');
      root.style.setProperty('--drag-cursor', session.cursor ?? 'grabbing');
      stopRef.current = onCancel;
    },
    [],
  );
}
