import { useMemo, useRef, useState } from 'react';

export type DropZoneState = 'idle' | 'armed' | 'over';

/** Imperative handle passed to draggables; stable for the component's lifetime. */
export interface DropZoneController {
  /** True when the client-space point lies inside the zone. */
  contains(clientX: number, clientY: number): boolean;
  setState(state: DropZoneState): void;
}

/**
 * A drop target that draggables query by hit-testing the pointer, rather
 * than relying on HTML5 drag-and-drop (which has poor styling control and
 * inconsistent behaviour across browsers).
 */
export function useDropZone<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  const [state, setState] = useState<DropZoneState>('idle');

  const controller = useMemo<DropZoneController>(
    () => ({
      contains(clientX, clientY) {
        const box = ref.current?.getBoundingClientRect();
        return (
          !!box &&
          clientX >= box.left &&
          clientX <= box.right &&
          clientY >= box.top &&
          clientY <= box.bottom
        );
      },
      setState,
    }),
    [],
  );

  return { ref, state, controller } as const;
}
