import { useCallback, useRef, useState } from 'react';
import { Board } from './components/Board';
import { Toolbar } from './components/Toolbar';
import { TrashZone } from './components/TrashZone';
import { fitRect, type Rect, type Size } from './domain/geometry';
import { DEFAULT_NOTE_SIZE, MIN_NOTE_SIZE, type NoteColor, type NoteId } from './domain/note';
import { useDropZone } from './hooks/useDropZone';
import type { NotesRepository } from './persistence/NotesRepository';
import { useNotes } from './state/useNotes';

interface AppProps {
  repository: NotesRepository;
}

/** Offset applied to successive toolbar-created notes so they don't stack exactly. */
const CASCADE_STEP = 28;
const CASCADE_LENGTH = 6;

export function App({ repository }: AppProps) {
  const { notes, actions, status } = useNotes(repository);
  const trash = useDropZone<HTMLDivElement>();
  const boardRef = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState<NoteColor>('yellow');
  const [focusedId, setFocusedId] = useState<NoteId | null>(null);
  const disabled = status === 'loading' || status === 'load-error';

  const getBounds = useCallback(
    (): Size => ({
      width: boardRef.current?.clientWidth ?? 0,
      height: boardRef.current?.clientHeight ?? 0,
    }),
    [],
  );

  const createNote = useCallback(
    (rect: Rect) => {
      const id = actions.add(fitRect(rect, { min: MIN_NOTE_SIZE, bounds: getBounds() }), color);
      setFocusedId(id);
    },
    [actions, color, getBounds],
  );

  const addCascadedNote = () => {
    const bounds = getBounds();
    const step = (notes.length % CASCADE_LENGTH) * CASCADE_STEP;
    const start = ((CASCADE_LENGTH - 1) * CASCADE_STEP) / 2;
    createNote({
      ...DEFAULT_NOTE_SIZE,
      x: (bounds.width - DEFAULT_NOTE_SIZE.width) / 2 - start + step,
      y: (bounds.height - DEFAULT_NOTE_SIZE.height) / 2 - start + step,
    });
  };

  return (
    <div className="app">
      <Toolbar
        color={color}
        onColorChange={setColor}
        onAddNote={addCascadedNote}
        status={status}
        disabled={disabled}
      />
      <main className="app__workspace">
        <Board
          ref={boardRef}
          notes={notes}
          actions={actions}
          trash={trash.controller}
          getBounds={getBounds}
          onCreate={createNote}
          focusedId={focusedId}
          disabled={disabled}
        />
        <TrashZone ref={trash.ref} state={trash.state} />
      </main>
    </div>
  );
}
