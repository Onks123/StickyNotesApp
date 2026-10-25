import { rectsEqual, type Rect } from '../domain/geometry';
import type { Note, NoteColor, NoteId } from '../domain/note';

export type NotesState = readonly Note[];

export type NotesAction =
  | { readonly type: 'hydrate'; readonly notes: readonly Note[] }
  | { readonly type: 'add'; readonly id: NoteId; readonly rect: Rect; readonly color: NoteColor }
  | { readonly type: 'setRect'; readonly id: NoteId; readonly rect: Rect }
  | { readonly type: 'setText'; readonly id: NoteId; readonly text: string }
  | { readonly type: 'setColor'; readonly id: NoteId; readonly color: NoteColor }
  | { readonly type: 'bringToFront'; readonly id: NoteId }
  | { readonly type: 'remove'; readonly id: NoteId };

function topZ(notes: NotesState): number {
  return notes.reduce((max, note) => Math.max(max, note.z), 0);
}

/** Applies `update` to one note. Returns the original array when nothing changed. */
function updateNote(
  notes: NotesState,
  id: NoteId,
  update: (note: Note) => Note,
): NotesState {
  let changed = false;
  const next = notes.map((note) => {
    if (note.id !== id) return note;
    const updated = update(note);
    changed = updated !== note;
    return updated;
  });
  return changed ? next : notes;
}

/**
 * Pure reducer. Every no-op returns the previous state by reference, so React
 * skips the re-render and the persistence layer skips a redundant save.
 */
export function notesReducer(state: NotesState, action: NotesAction): NotesState {
  switch (action.type) {
    case 'hydrate':
      return action.notes;

    case 'add':
      return [
        ...state,
        { id: action.id, rect: action.rect, color: action.color, text: '', z: topZ(state) + 1 },
      ];

    case 'setRect':
      return updateNote(state, action.id, (note) =>
        rectsEqual(note.rect, action.rect) ? note : { ...note, rect: action.rect },
      );

    case 'setText':
      return updateNote(state, action.id, (note) =>
        note.text === action.text ? note : { ...note, text: action.text },
      );

    case 'setColor':
      return updateNote(state, action.id, (note) =>
        note.color === action.color ? note : { ...note, color: action.color },
      );

    case 'bringToFront': {
      const top = topZ(state);
      const isUniqueTop = (note: Note) =>
        note.z === top && state.every((other) => other === note || other.z < top);
      return updateNote(state, action.id, (note) =>
        isUniqueTop(note) ? note : { ...note, z: top + 1 },
      );
    }

    case 'remove': {
      const next = state.filter((note) => note.id !== action.id);
      return next.length === state.length ? state : next;
    }
  }
}
