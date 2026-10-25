import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note, NoteId } from '../domain/note';
import { createLatestSaver, type SaveStatus } from './createLatestSaver';
import { LocalStorageNotesRepository } from './LocalStorageNotesRepository';
import { MockApiNotesRepository } from './MockApiNotesRepository';

const sample: Note = {
  id: 'n1' as NoteId,
  rect: { x: 1, y: 2, width: 150, height: 100 },
  text: 'hi',
  color: 'blue',
  z: 1,
};

beforeEach(() => localStorage.clear());

describe('createLatestSaver', () => {
  it('never overlaps saves and only saves the latest queued value', async () => {
    const saved: number[] = [];
    const statuses: SaveStatus[] = [];
    let active = 0;
    const saver = createLatestSaver(
      async (value: number) => {
        active += 1;
        expect(active).toBe(1);
        await new Promise((resolve) => setTimeout(resolve, 5));
        saved.push(value);
        active -= 1;
      },
      (status) => statuses.push(status),
    );

    saver.push(1);
    saver.push(2);
    saver.push(3);
    await vi.waitFor(() => expect(statuses.at(-1)).toBe('saved'));

    expect(saved).toEqual([1, 3]);
    expect(statuses).toEqual(['saving', 'saved']);
  });

  it('reports an error when the last save fails', async () => {
    const statuses: SaveStatus[] = [];
    const saver = createLatestSaver(() => Promise.reject(new Error('boom')), (s) => statuses.push(s));
    saver.push(1);
    await vi.waitFor(() => expect(statuses).toEqual(['saving', 'error']));
  });
});

describe('repositories', () => {
  it('round-trips through localStorage', async () => {
    const repo = new LocalStorageNotesRepository('test');
    await repo.save([sample]);
    expect(await repo.load()).toEqual([sample]);
  });

  it('drops malformed records instead of crashing', async () => {
    localStorage.setItem('test', JSON.stringify([sample, { id: 1 }, null]));
    expect(await new LocalStorageNotesRepository('test').load()).toEqual([sample]);
    localStorage.setItem('test', '{not json');
    expect(await new LocalStorageNotesRepository('test').load()).toEqual([]);
  });

  it('mock API resolves asynchronously and persists', async () => {
    const repo = new MockApiNotesRepository('api', { latency: [1, 5] });
    const pending = repo.save([sample]);
    expect(localStorage.getItem('api')).toBeNull();
    await pending;
    expect(await repo.load()).toEqual([sample]);
  });

  it('mock API rejects when configured to fail', async () => {
    const repo = new MockApiNotesRepository('api', { latency: [1, 1], failureRate: 1 });
    await expect(repo.load()).rejects.toMatchObject({ status: 503 });
  });
});
