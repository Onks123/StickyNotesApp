import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Rect } from '../domain/geometry';
import { createNoteId, type NoteColor, type NoteId } from '../domain/note';
import { createLatestSaver, type SaveStatus } from '../persistence/createLatestSaver';
import type { NotesRepository } from '../persistence/NotesRepository';
import { notesReducer, type NotesState } from './notesReducer';

export type SyncStatus = 'loading' | 'load-error' | SaveStatus;

export interface NoteActions {
  add(rect: Rect, color: NoteColor): NoteId;
  setRect(id: NoteId, rect: Rect): void;
  setText(id: NoteId, text: string): void;
  setColor(id: NoteId, color: NoteColor): void;
  bringToFront(id: NoteId): void;
  remove(id: NoteId): void;
}

const SAVE_DEBOUNCE_MS = 300;

/**
 * Owns the notes state and keeps it in sync with a repository: loads once,
 * then saves debounced snapshots. `actions` is referentially stable, which
 * lets memoised note components skip re-rendering when siblings change.
 */
export function useNotes(repository: NotesRepository) {
  const [notes, dispatch] = useReducer(notesReducer, []);
  const [status, setStatus] = useState<SyncStatus>('loading');
  const lastSynced = useRef<NotesState | null>(null);
  const latestNotes = useRef(notes);

  useEffect(() => {
    latestNotes.current = notes;
  }, [notes]);

  const saver = useMemo(
    () => createLatestSaver((snapshot: NotesState) => repository.save(snapshot), setStatus),
    [repository],
  );

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    repository.load().then(
      (loaded) => {
        if (cancelled) return;
        lastSynced.current = loaded;
        dispatch({ type: 'hydrate', notes: loaded });
        setStatus('saved');
      },
      () => {
        if (!cancelled) setStatus('load-error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => {
    // Skip until loaded, and skip the snapshot we just loaded or saved.
    if (lastSynced.current === null || notes === lastSynced.current) return;
    const timer = setTimeout(() => {
      lastSynced.current = notes;
      saver.push(notes);
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [notes, saver]);

  useEffect(() => {
    const flush = () => {
      const current = latestNotes.current;
      if (lastSynced.current !== null && current !== lastSynced.current) {
        lastSynced.current = current;
        saver.push(current);
      }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [saver]);

  const actions = useMemo<NoteActions>(
    () => ({
      add(rect, color) {
        const id = createNoteId();
        dispatch({ type: 'add', id, rect, color });
        return id;
      },
      setRect: (id, rect) => dispatch({ type: 'setRect', id, rect }),
      setText: (id, text) => dispatch({ type: 'setText', id, text }),
      setColor: (id, color) => dispatch({ type: 'setColor', id, color }),
      bringToFront: (id) => dispatch({ type: 'bringToFront', id }),
      remove: (id) => dispatch({ type: 'remove', id }),
    }),
    [],
  );

  return { notes, actions, status } as const;
}
