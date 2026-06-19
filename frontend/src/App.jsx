import { useState } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import Editor from './components/editor/Editor';
import ExerciseLibraryPage from './pages/ExerciseLibraryPage';

function navClassName({ isActive }) {
  return `app-nav-link${isActive ? ' active' : ''}`;
}

export default function App() {
  const [currentEditorTemplate, setCurrentEditorTemplate] = useState(null);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand-kicker">Trainer-Tool</span>
          <h1>Fussball Editor</h1>
        </div>

        <nav className="app-nav" aria-label="Hauptnavigation">
          <NavLink to="/editor" className={navClassName}>
            Editor
          </NavLink>
          <NavLink to="/uebungsbibliothek" className={navClassName}>
            Übungsbibliothek
          </NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/editor" replace />} />
          <Route path="/editor" element={<Editor initialTemplate={currentEditorTemplate} />} />
          <Route
            path="/uebungsbibliothek"
            element={<ExerciseLibraryPage onOpenInEditor={setCurrentEditorTemplate} />}
          />
        </Routes>
      </main>
    </div>
  );
}
