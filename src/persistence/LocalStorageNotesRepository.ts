import { parseNotes, type Note } from '../domain/note';
import type { NotesRepository } from './NotesRepository';

export class LocalStorageNotesRepository implements NotesRepository {
  constructor(
    private readonly key: string,
    private readonly storage: Storage = window.localStorage,
  ) {}

  load(): Promise<Note[]> {
    try {
      const raw = this.storage.getItem(this.key);
      return Promise.resolve(raw === null ? [] : parseNotes(JSON.parse(raw)));
    } catch {
      // Corrupt or inaccessible storage should not prevent the app from starting.
      return Promise.resolve([]);
    }
  }

  // Writes synchronously before resolving, so a flush on `pagehide` is not lost.
  save(notes: readonly Note[]): Promise<void> {
    try {
      this.storage.setItem(this.key, JSON.stringify(notes));
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
