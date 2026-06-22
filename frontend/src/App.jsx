import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [currentEditorTemplate, setCurrentEditorTemplate] = useState(null);
  // Erzwingt einen frischen Editor-Mount fuer "Leere Uebung", auch wenn
  // bereits kein Template mehr aktiv ist.
  const [editorResetVersion, setEditorResetVersion] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  // Mobile-Navigation ist absichtlich komplett getrennt von der Desktop-Navigation,
  // damit die Desktop-Links unveraendert bleiben und Mobile ein kompaktes Menue bekommt.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  useEffect(() => {
    // Route-Wechsel sollen das mobile Menue immer schliessen, damit es nach
    // einer Navigation nicht offen "haengen bleibt".
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setAuthReady(true);
  };

  const handleLogout = () => {
    window.localStorage.removeItem('token');
    setCurrentUser(null);
    setCurrentEditorTemplate(null);
    setEditorResetVersion(0);
  };

  const handleNewEditor = () => {
    setCurrentEditorTemplate(null);
    setEditorResetVersion((current) => current + 1);
    navigate('/editor');
  };

  const handleMobileNavigate = (to) => {
    navigate(to);
    setMobileNavOpen(false);
  };

  const handleMobileNewEditor = () => {
    handleNewEditor();
    setMobileNavOpen(false);
  };

  const handleMobileLogout = () => {
    handleLogout();
    navigate('/login');
    setMobileNavOpen(false);
  };

  const editorInstanceKey = currentEditorTemplate
    ? [
        currentEditorTemplate.id ?? 'template',
        currentEditorTemplate.source?.type ?? 'source',
        currentEditorTemplate.source?.externalId ?? 'external',
        currentEditorTemplate.meta?.title ?? 'title',
        editorResetVersion,
      ].join(':')
    : `empty-editor:${editorResetVersion}`;
  // Der Key trennt drei Faelle sauber:
  // 1. gespeicherte lokale Uebung
  // 2. importierte/externe Vorlage
  // 3. bewusst neu gestarteter leerer Editor

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <img src="/favicon.png" alt="Das Trainertool" className="app-brand-logo" />
          <div className="app-brand-text">
            <span className="app-brand-kicker">Trainer-Tool</span>
            <h1>Fussball Editor</h1>
          </div>
        </div>

        <nav className="app-nav app-nav-desktop" aria-label="Hauptnavigation">
          <NavLink to="/uebungsbibliothek" className={navClassName}>
            Übungsbibliothek
          </NavLink>
          <NavLink to="/editor" className={navClassName}>
            Editor
          </NavLink>
          <button className="app-nav-link app-nav-button" type="button" onClick={handleNewEditor}>
            Leere Übung
          </button>
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

        <div className="app-mobile-nav">
          <button
            className="app-nav-link app-nav-button app-mobile-nav-toggle"
            type="button"
            onClick={() => setMobileNavOpen((current) => !current)}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-navigation-menu"
          >
            ☰ Menü
          </button>

          {mobileNavOpen && (
            <div className="app-mobile-nav-menu" id="mobile-navigation-menu">
              <button className="app-mobile-nav-item" type="button" onClick={() => handleMobileNavigate('/editor')}>
                Editor
              </button>
              <button className="app-mobile-nav-item" type="button" onClick={handleMobileNewEditor}>
                Leere Übung
              </button>
              <button className="app-mobile-nav-item" type="button" onClick={() => handleMobileNavigate('/uebungsbibliothek')}>
                Übungsbibliothek
              </button>
              <button className="app-mobile-nav-item" type="button" onClick={() => handleMobileNavigate('/meine-uebungen')}>
                Meine Übungen
              </button>
              <button className="app-mobile-nav-item" type="button" onClick={() => handleMobileNavigate('/pdf-upload')}>
                Import
              </button>
              {currentUser ? (
                <button className="app-mobile-nav-item" type="button" onClick={handleMobileLogout}>
                  Logout
                </button>
              ) : (
                <button className="app-mobile-nav-item" type="button" onClick={() => handleMobileNavigate('/login')}>
                  Login
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/uebungsbibliothek" replace />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route
            path="/editor"
            element={(
              <ProtectedRoute isAuthenticated={Boolean(currentUser)} authReady={authReady}>
                <Editor key={editorInstanceKey} initialTemplate={currentEditorTemplate} />
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
