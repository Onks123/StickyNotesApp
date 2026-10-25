import { describe, expect, it } from 'vitest';
import type { Note, NoteId } from '../domain/note';
import { notesReducer, type NotesState } from './notesReducer';

const id = (value: string) => value as NoteId;
const rect = { x: 10, y: 10, width: 200, height: 150 };

function note(value: string, z: number): Note {
  return { id: id(value), rect, text: '', color: 'yellow', z };
}

const state: NotesState = [note('a', 1), note('b', 2)];

describe('notesReducer', () => {
  it('adds a note on top of the stack', () => {
    const next = notesReducer(state, { type: 'add', id: id('c'), rect, color: 'pink' });
    expect(next).toHaveLength(3);
    expect(next[2]).toMatchObject({ id: 'c', z: 3, color: 'pink', text: '' });
  });

  it('brings a note to the front', () => {
    const next = notesReducer(state, { type: 'bringToFront', id: id('a') });
    expect(next.find((n) => n.id === 'a')?.z).toBe(3);
  });

  it('returns the same state for no-op updates', () => {
    expect(notesReducer(state, { type: 'bringToFront', id: id('b') })).toBe(state);
    expect(notesReducer(state, { type: 'setRect', id: id('a'), rect: { ...rect } })).toBe(state);
    expect(notesReducer(state, { type: 'setText', id: id('a'), text: '' })).toBe(state);
    expect(notesReducer(state, { type: 'remove', id: id('missing') })).toBe(state);
  });

  it('keeps untouched notes by reference so memoised views skip rendering', () => {
    const next = notesReducer(state, { type: 'setText', id: id('a'), text: 'hello' });
    expect(next[0]?.text).toBe('hello');
    expect(next[1]).toBe(state[1]);
  });

  it('removes a note', () => {
    expect(notesReducer(state, { type: 'remove', id: id('a') }).map((n) => n.id)).toEqual(['b']);
  });

  it('lifts a note that shares the top z-index', () => {
    const tied: NotesState = [note('a', 2), note('b', 2)];
    expect(notesReducer(tied, { type: 'bringToFront', id: id('a') })[0]?.z).toBe(3);
  });
});
