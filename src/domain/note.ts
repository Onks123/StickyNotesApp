import type { Rect, Size } from './geometry';

export type NoteId = string & { readonly __brand: 'NoteId' };

export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export interface Note {
  readonly id: NoteId;
  readonly rect: Rect;
  readonly text: string;
  readonly color: NoteColor;
  /** Stacking order. Higher values render on top. */
  readonly z: number;
}

export const MIN_NOTE_SIZE: Size = { width: 120, height: 90 };
export const DEFAULT_NOTE_SIZE: Size = { width: 220, height: 180 };

export function createNoteId(): NoteId {
  return crypto.randomUUID() as NoteId;
}

export function nextColor(color: NoteColor): NoteColor {
  const index = NOTE_COLORS.indexOf(color);
  return NOTE_COLORS[(index + 1) % NOTE_COLORS.length] ?? NOTE_COLORS[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRect(value: unknown): value is Rect {
  return (
    isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height)
  );
}

function isNoteColor(value: unknown): value is NoteColor {
  return NOTE_COLORS.some((color) => color === value);
}

/** Runtime guard for data coming from storage or the network. */
export function isNote(value: unknown): value is Note {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    isFiniteNumber(value.z) &&
    isNoteColor(value.color) &&
    isRect(value.rect)
  );
}

export function parseNotes(value: unknown): Note[] {
  return Array.isArray(value) ? value.filter(isNote) : [];
}
