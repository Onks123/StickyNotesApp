import { NOTE_COLORS, type NoteColor } from '../domain/note';
import type { SyncStatus } from '../state/useNotes';

interface ToolbarProps {
  color: NoteColor;
  onColorChange: (color: NoteColor) => void;
  onAddNote: () => void;
  status: SyncStatus;
  disabled: boolean;
}

const STATUS_LABELS: Record<SyncStatus, string> = {
  loading: 'Loading…',
  'load-error': 'Could not load notes',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Could not save changes',
};

export function Toolbar({ color, onColorChange, onAddNote, status, disabled }: ToolbarProps) {
  return (
    <header className="toolbar">
      <h1 className="toolbar__title">Sticky Notes</h1>

      <div className="toolbar__group" role="radiogroup" aria-label="Colour for new notes">
        {NOTE_COLORS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === color}
            aria-label={option}
            className="swatch"
            data-color={option}
            onClick={() => onColorChange(option)}
          />
        ))}
      </div>

      <button type="button" className="toolbar__add" onClick={onAddNote} disabled={disabled}>
        + New note
      </button>

      <span className="toolbar__status" data-status={status} role="status">
        {STATUS_LABELS[status]}
      </span>
    </header>
  );
}
