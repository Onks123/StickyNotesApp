# Sticky Notes

A single-page sticky notes board built with React 19 and TypeScript, with no UI or drag-and-drop libraries.

## Running it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

By default notes are saved through an asynchronous mock REST API. Open `http://localhost:5173/?backend=local` to use plain localStorage instead.

## Using it

- **Create:** drag on an empty part of the board to draw a note at exactly that position and size. A live size label shows the dimensions. Double-click the board for a default-size note under the cursor, or use **+ New note**.
- **Move:** drag a note by its coloured header.
- **Resize:** drag any edge or corner. Notes keep a minimum size and stay inside the board.
- **Delete:** drag a note onto the bin in the bottom-right corner. The bin highlights when a drag starts and turns red when the pointer is over it.
- **Cancel:** press Escape mid-drag to put the note back.

All five optional features are included: text editing, bring-to-front on click, persistence across reloads, per-note colours (the dot in the header cycles colours, the toolbar picks the colour for new notes), and the async mock API with a save status indicator.

## Architecture

The code is split into layers that depend in one direction only. `domain/` holds plain types and pure functions: the `Note` model with a runtime guard for untrusted stored data, and the rectangle geometry (move, resize from any of eight handles, clamping to bounds). `state/` holds a pure reducer for all note mutations, plus a `useNotes` hook that wraps it and connects it to a `NotesRepository`. `persistence/` defines that repository interface with two implementations, localStorage and an async mock REST API. Components in `components/` only render and translate pointer input into actions. This keeps the interesting logic testable without a DOM, and the unit tests cover geometry, the reducer and the save pipeline.

All dragging goes through one generic `usePointerDrag` hook. It handles window-level pointer listeners, requestAnimationFrame throttling, Escape and pointercancel, and cleanup on unmount. Moving, resizing and drawing a new note are just different sessions passed to it. I used Pointer Events rather than the HTML5 drag-and-drop API, which offers little control over visuals and behaves inconsistently across browsers. The trash is a drop zone that draggables hit-test against the pointer position through a small stable controller, so notes don't need to know about the trash component.

For performance, the in-progress geometry of a drag lives in local state inside the dragged `NoteView` and is committed to the store once, on drop. During a drag only that one note re-renders, and it is positioned with `transform` to avoid layout work. `NoteView` is memoised, the action object is referentially stable, and the reducer returns the previous state for no-op updates, so unchanged notes never re-render and no redundant saves happen. Saving is debounced and serialised through a "latest wins" queue. With a real async API this guarantees an older, slower request can never overwrite newer data, and intermediate snapshots are skipped. Pending changes are also flushed on `pagehide`.

## Trade-offs and next steps

- Saving sends the whole board as one snapshot. That is simple and fine at this scale. A real API would more likely take per-note PATCH requests.
- The board is fixed to the viewport. If the window shrinks after notes were placed near the right or bottom edge, those notes can end up out of view. A scrollable or zoomable canvas would fix this.
- Notes are mouse-driven. Keyboard move and resize would be the next accessibility step.
