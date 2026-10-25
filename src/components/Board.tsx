import { useState, type MouseEvent as ReactMouseEvent, type Ref } from 'react';
import { rectFromPoints, type Point, type Rect, type Size } from '../domain/geometry';
import { DEFAULT_NOTE_SIZE, type Note, type NoteId } from '../domain/note';
import type { DropZoneController } from '../hooks/useDropZone';
import { usePointerDrag } from '../hooks/usePointerDrag';
import type { NoteActions } from '../state/useNotes';
import { NoteView } from './NoteView';

interface BoardProps {
  ref: Ref<HTMLDivElement>;
  notes: readonly Note[];
  actions: NoteActions;
  trash: DropZoneController;
  getBounds: () => Size;
  onCreate: (rect: Rect) => void;
  focusedId: NoteId | null;
  disabled: boolean;
}

/** Below this drag distance a press on the board counts as a click, not a drawn note. */
const CLICK_TOLERANCE = 4;

function localPoint(element: Element, clientX: number, clientY: number): Point {
  const box = element.getBoundingClientRect();
  return { x: clientX - box.left, y: clientY - box.top };
}

export function Board({
  ref,
  notes,
  actions,
  trash,
  getBounds,
  onCreate,
  focusedId,
  disabled,
}: BoardProps) {
  const [draft, setDraft] = useState<Rect | null>(null);

  const startDraw = usePointerDrag<HTMLDivElement>((event) => {
    if (event.target !== event.currentTarget) return null;
    const board = event.currentTarget;
    const anchor = localPoint(board, event.clientX, event.clientY);
    const rectTo = (delta: Point) =>
      rectFromPoints(anchor, { x: anchor.x + delta.x, y: anchor.y + delta.y });

    return {
      cursor: 'crosshair',
      onMove(delta) {
        setDraft(rectTo(delta));
      },
      onEnd(delta) {
        setDraft(null);
        if (Math.hypot(delta.x, delta.y) > CLICK_TOLERANCE) onCreate(rectTo(delta));
      },
      onCancel: () => setDraft(null),
    };
  });

  const createAtPoint = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const { x, y } = localPoint(event.currentTarget, event.clientX, event.clientY);
    onCreate({
      ...DEFAULT_NOTE_SIZE,
      x: x - DEFAULT_NOTE_SIZE.width / 2,
      y: y - DEFAULT_NOTE_SIZE.height / 2,
    });
  };

  return (
    <div
      ref={ref}
      className="board"
      aria-busy={disabled}
      inert={disabled}
      onPointerDown={startDraw}
      onDoubleClick={createAtPoint}
    >
      {notes.map((note) => (
        <NoteView
          key={note.id}
          note={note}
          actions={actions}
          trash={trash}
          getBounds={getBounds}
          autoFocus={note.id === focusedId}
        />
      ))}
      {draft && (
        <div
          className="board__draft"
          style={{
            transform: `translate3d(${draft.x}px, ${draft.y}px, 0)`,
            width: draft.width,
            height: draft.height,
          }}
        >
          <span className="board__draft-size">
            {Math.round(draft.width)} × {Math.round(draft.height)}
          </span>
        </div>
      )}
      {notes.length === 0 && !disabled && (
        <p className="board__empty">
          Drag on the board to draw a note, or double-click to drop one.
        </p>
      )}
    </div>
  );
}
