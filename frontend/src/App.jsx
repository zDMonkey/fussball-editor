import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import Editor from './components/editor/Editor';
import ExerciseLibraryPage from './pages/ExerciseLibraryPage';
import MyExercisesPage from './pages/MyExercisesPage';
import PdfUploadPage from './pages/PdfUploadPage';
import LoginPage from './pages/LoginPage';
import { fetchCurrentUser } from './lib/authApi';

function navClassName({ isActive }) {
  return `app-nav-link${isActive ? ' active' : ''}`;
}

function ProtectedRoute({ isAuthenticated, authReady, children }) {
  const location = useLocation();

  if (!authReady) {
    return <div className="library-state">Authentifizierung wird geprüft...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export default function App() {
  const [currentEditorTemplate, setCurrentEditorTemplate] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem('token');

    if (!token) {
      setAuthReady(true);
      return;
    }

    let active = true;

    async function loadCurrentUser() {
      try {
        const result = await fetchCurrentUser();
        if (!active) return;
        setCurrentUser(result.user ?? null);
      } catch {
        window.localStorage.removeItem('token');
        if (!active) return;
        setCurrentUser(null);
      } finally {
        if (active) {
          setAuthReady(true);
        }
      }
    }

    loadCurrentUser();

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setAuthReady(true);
  };

  const handleLogout = () => {
    window.localStorage.removeItem('token');
    setCurrentUser(null);
    setCurrentEditorTemplate(null);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand-kicker">Trainer-Tool</span>
          <h1>Fussball Editor</h1>
        </div>

        <nav className="app-nav" aria-label="Hauptnavigation">
          <NavLink to="/uebungsbibliothek" className={navClassName}>
            Übungsbibliothek
          </NavLink>
          <NavLink to="/editor" className={navClassName}>
            Editor
          </NavLink>
          <NavLink to="/meine-uebungen" className={navClassName}>
            Meine Übungen
          </NavLink>
          <NavLink to="/pdf-upload" className={navClassName}>
            Import
          </NavLink>
          {currentUser ? (
            <button className="app-nav-link app-nav-button" type="button" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <NavLink to="/login" className={navClassName}>
              Login
            </NavLink>
          )}
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/uebungsbibliothek" replace />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route
            path="/editor"
            element={(
              <ProtectedRoute isAuthenticated={Boolean(currentUser)} authReady={authReady}>
                <Editor initialTemplate={currentEditorTemplate} />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/meine-uebungen"
            element={(
              <ProtectedRoute isAuthenticated={Boolean(currentUser)} authReady={authReady}>
                <MyExercisesPage onOpenInEditor={setCurrentEditorTemplate} />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/pdf-upload"
            element={(
              <ProtectedRoute isAuthenticated={Boolean(currentUser)} authReady={authReady}>
                <PdfUploadPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/uebungsbibliothek"
            element={<ExerciseLibraryPage onOpenInEditor={setCurrentEditorTemplate} />}
          />
        </Routes>
      </main>
    </div>
  );
}
