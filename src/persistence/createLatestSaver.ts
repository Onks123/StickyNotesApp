export type SaveStatus = 'saving' | 'saved' | 'error';

export interface LatestSaver<T> {
  /** Queues `value` for saving. Only the most recent value is kept while a save is in flight. */
  push(value: T): void;
}

/**
 * Serialises async saves so they never overlap. With a plain fire-and-forget
 * approach a slow, older request could resolve after a newer one and leave
 * stale data on the server. Intermediate values are dropped (latest wins).
 */
export function createLatestSaver<T>(
  save: (value: T) => Promise<void>,
  onStatus: (status: SaveStatus) => void,
): LatestSaver<T> {
  let pending: { value: T } | null = null;
  let running = false;

  async function drain(): Promise<void> {
    running = true;
    onStatus('saving');
    let failed = false;
    while (pending) {
      const { value } = pending;
      pending = null;
      try {
        await save(value);
        failed = false;
      } catch {
        failed = true;
      }
    }
    running = false;
    onStatus(failed ? 'error' : 'saved');
  }

  return {
    push(value) {
      pending = { value };
      if (!running) void drain();
    },
  };
}
