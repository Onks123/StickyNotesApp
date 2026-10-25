import type { Note } from '../domain/note';

/** Storage boundary. The UI never knows whether notes live locally or behind an API. */
export interface NotesRepository {
  load(): Promise<Note[]>;
  save(notes: readonly Note[]): Promise<void>;
}
