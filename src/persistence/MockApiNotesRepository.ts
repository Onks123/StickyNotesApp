import { parseNotes, type Note } from '../domain/note';
import type { NotesRepository } from './NotesRepository';

export interface MockApiOptions {
  /** Simulated network latency range in ms. */
  readonly latency?: readonly [min: number, max: number];
  /** Probability (0..1) that a request fails, for exercising error states. */
  readonly failureRate?: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * In-browser stand-in for `GET /api/notes` and `PUT /api/notes`.
 * Responses are asynchronous with random latency, so out-of-order completion
 * is possible. The "server" persists to localStorage so data survives reloads.
 */
export class MockApiNotesRepository implements NotesRepository {
  private readonly latency: readonly [number, number];
  private readonly failureRate: number;

  constructor(
    private readonly storageKey = 'sticky-notes:mock-api',
    { latency = [150, 600], failureRate = 0 }: MockApiOptions = {},
  ) {
    this.latency = latency;
    this.failureRate = failureRate;
  }

  async load(): Promise<Note[]> {
    const body = await this.request(() => localStorage.getItem(this.storageKey) ?? '[]');
    return parseNotes(JSON.parse(body));
  }

  async save(notes: readonly Note[]): Promise<void> {
    // Serialise at call time, like a real request body, so later mutations can't leak in.
    const body = JSON.stringify(notes);
    await this.request(() => localStorage.setItem(this.storageKey, body));
  }

  private request<T>(handler: () => T): Promise<T> {
    const [min, max] = this.latency;
    const delay = min + Math.random() * (max - min);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < this.failureRate) {
          reject(new ApiError(503, 'Service unavailable'));
          return;
        }
        try {
          resolve(handler());
        } catch (error) {
          reject(new ApiError(500, error instanceof Error ? error.message : 'Server error'));
        }
      }, delay);
    });
  }
}
