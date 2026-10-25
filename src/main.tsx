import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LocalStorageNotesRepository } from './persistence/LocalStorageNotesRepository';
import { MockApiNotesRepository } from './persistence/MockApiNotesRepository';
import type { NotesRepository } from './persistence/NotesRepository';
import './styles.css';

// `?backend=local` uses localStorage directly; the default is the async mock REST API.
function createRepository(): NotesRepository {
  const backend = new URLSearchParams(window.location.search).get('backend');
  return backend === 'local'
    ? new LocalStorageNotesRepository('sticky-notes:local')
    : new MockApiNotesRepository();
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App repository={createRepository()} />
  </StrictMode>,
);
