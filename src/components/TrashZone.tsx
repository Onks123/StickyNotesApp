import type { Ref } from 'react';
import type { DropZoneState } from '../hooks/useDropZone';

interface TrashZoneProps {
  ref: Ref<HTMLDivElement>;
  state: DropZoneState;
}

export function TrashZone({ ref, state }: TrashZoneProps) {
  return (
    <div ref={ref} className="trash" data-state={state} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
      </svg>
      <span className="trash__label">{state === 'over' ? 'Release to delete' : 'Drop to delete'}</span>
    </div>
  );
}
