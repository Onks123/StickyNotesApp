import { memo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  RESIZE_HANDLES,
  resizeRect,
  translateRect,
  type Rect,
  type ResizeHandle,
  type Size,
} from '../domain/geometry';
import { MIN_NOTE_SIZE, nextColor, type Note } from '../domain/note';
import type { DropZoneController } from '../hooks/useDropZone';
import { usePointerDrag } from '../hooks/usePointerDrag';
import type { NoteActions } from '../state/useNotes';

interface NoteViewProps {
  note: Note;
  actions: NoteActions;
  trash: DropZoneController;
  getBounds: () => Size;
  autoFocus: boolean;
}

/** Transient geometry while a drag is in progress. Committed to the store on drop. */
interface DragPreview {
  readonly rect: Rect;
  readonly overTrash: boolean;
}

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

function handleOf(element: HTMLElement): ResizeHandle | undefined {
  return RESIZE_HANDLES.find((handle) => handle === element.dataset.handle);
}

function isFromButton(event: ReactPointerEvent): boolean {
  return event.target instanceof Element && event.target.closest('button') !== null;
}

/**
 * Drag state lives here rather than in the store, so a drag re-renders only
 * this note and persistence only sees the final position.
 */
export const NoteView = memo(function NoteView({
  note,
  actions,
  trash,
  getBounds,
  autoFocus,
}: NoteViewProps) {
  const [preview, setPreview] = useState<DragPreview | null>(null);

  const startMove = usePointerDrag<HTMLDivElement>((event) => {
    if (isFromButton(event)) return null;
    const origin = note.rect;
    const bounds = getBounds();
    const isOverTrash = (e: PointerEvent) => trash.contains(e.clientX, e.clientY);
    const reset = () => {
      trash.setState('idle');
      setPreview(null);
    };
    trash.setState('armed');

    return {
      onMove(delta, e) {
        const overTrash = isOverTrash(e);
        trash.setState(overTrash ? 'over' : 'armed');
        setPreview({ rect: translateRect(origin, delta, bounds), overTrash });
      },
      onEnd(delta, e) {
        reset();
        if (isOverTrash(e)) actions.remove(note.id);
        else actions.setRect(note.id, translateRect(origin, delta, bounds));
      },
      onCancel: reset,
    };
  });

  const startResize = usePointerDrag<HTMLDivElement>((event) => {
    const handle = handleOf(event.currentTarget);
    if (!handle) return null;
    const origin = note.rect;
    const constraints = { min: MIN_NOTE_SIZE, bounds: getBounds() };
    const resized = (delta: { x: number; y: number }) =>
      resizeRect(origin, handle, delta, constraints);

    return {
      cursor: HANDLE_CURSORS[handle],
      onMove(delta) {
        setPreview({ rect: resized(delta), overTrash: false });
      },
      onEnd(delta) {
        setPreview(null);
        actions.setRect(note.id, resized(delta));
      },
      onCancel: () => setPreview(null),
    };
  });

  const { x, y, width, height } = preview?.rect ?? note.rect;
  const state = preview ? (preview.overTrash ? 'deleting' : 'dragging') : undefined;

  return (
    <div
      className="note"
      data-color={note.color}
      data-state={state}
      style={{ transform: `translate3d(${x}px, ${y}px, 0)`, width, height, zIndex: note.z }}
      onPointerDownCapture={() => actions.bringToFront(note.id)}
    >
      <div className="note__header" onPointerDown={startMove} title="Drag to move">
        <span className="note__grip" aria-hidden="true" />
        <button
          type="button"
          className="note__color"
          aria-label={`Change colour (currently ${note.color})`}
          title="Change colour"
          onClick={() => actions.setColor(note.id, nextColor(note.color))}
        />
      </div>
      <textarea
        className="note__text"
        name={`note-${note.id}`}
        aria-label="Note text"
        placeholder="Write something…"
        value={note.text}
        autoFocus={autoFocus}
        onChange={(e) => actions.setText(note.id, e.target.value)}
      />
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle}
          className={`note__resize note__resize--${handle}`}
          data-handle={handle}
          onPointerDown={startResize}
          aria-hidden="true"
        />
      ))}
    </div>
  );
});