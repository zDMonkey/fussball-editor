import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mapSearchResultToExerciseTemplate } from '../lib/exerciseTemplate';

const EXERCISE_SEARCH_API = 'https://b5zb58pdy4.execute-api.eu-north-1.amazonaws.com/prod/search';
const MANUAL_THUMBNAIL_KEYS = {
  'testumschalten1.pdf': 'thumbnails/demo/testumschalten1-page-1.svg',
  'testumschalten4.pdf': 'thumbnails/demo/testumschalten1-page-1.svg',
};

function formatPlayerCount(min, max) {
  if (Number.isFinite(min) && Number.isFinite(max)) {
    return min === max ? `${min} Spieler` : `${min}-${max} Spieler`;
  }
  if (Number.isFinite(min)) return `Ab ${min} Spielern`;
  if (Number.isFinite(max)) return `Bis ${max} Spieler`;
  return 'Keine Angabe';
}

function normalizeResults(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function getThumbnailUrl(exercise) {
  const thumbnailKey =
    exercise.thumbnail_key ??
    MANUAL_THUMBNAIL_KEYS[exercise.source_key] ??
    MANUAL_THUMBNAIL_KEYS[exercise.exercise_id] ??
    '';

  if (!thumbnailKey) return '';
  if (thumbnailKey.startsWith('http://') || thumbnailKey.startsWith('https://') || thumbnailKey.startsWith('/')) {
    return thumbnailKey;
  }

  return `/${thumbnailKey}`;
}

export default function ExerciseLibraryPage({ onOpenInEditor = () => {} }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery));

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const trimmedQuery = initialQuery.trim();
    if (!trimmedQuery) {
      setResults([]);
      setLoading(false);
      setError('');
      setHasSearched(false);
      return;
    }

    const controller = new AbortController();

    async function loadExercises() {
      setLoading(true);
      setError('');
      setHasSearched(true);

      try {
        const response = await fetch(`${EXERCISE_SEARCH_API}?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API-Fehler (${response.status})`);
        }

        const payload = await response.json();
        setResults(normalizeResults(payload));
      } catch (err) {
        if (err.name === 'AbortError') return;
        setResults([]);
        setError('Die Übungssuche ist aktuell nicht erreichbar.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadExercises();

    return () => controller.abort();
  }, [initialQuery]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSearchParams({});
      setResults([]);
      setError('');
      setHasSearched(false);
      return;
    }

    setSearchParams({ q: trimmedQuery });
  };

  const handleOpenInEditor = (exercise) => {
    const template = mapSearchResultToExerciseTemplate(exercise);
    onOpenInEditor(template);
    navigate('/editor');
  };

  return (
    <section className="library-page">
      <div className="library-hero">
        <div>
          <p className="library-eyebrow">Externe Übungssuche</p>
          <h2>Übungsbibliothek</h2>
          <p className="library-intro">
            Durchsuche die angebundene Übungsdatenbank und hole dir passende Trainingsformen direkt ins Tool.
          </p>
        </div>

        <form className="library-search" onSubmit={handleSubmit}>
          <label className="library-search-label" htmlFor="exercise-query">
            Suchbegriff
          </label>
          <div className="library-search-row">
            <input
              id="exercise-query"
              className="library-search-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="z. B. Ballgewinn, Umschalten, Aufwärmen"
            />
            <button className="library-search-button" type="submit" disabled={loading}>
              {loading ? 'Suche läuft...' : 'Suchen'}
            </button>
          </div>
        </form>
      </div>

      {error && <div className="library-state library-state-error">{error}</div>}

      {!error && !hasSearched && (
        <div className="library-state">
          Gib einen Suchbegriff ein, um passende Fußballübungen aus der externen Bibliothek zu laden.
        </div>
      )}

      {!error && hasSearched && !loading && results.length === 0 && (
        <div className="library-state">
          Keine Treffer für <strong>{initialQuery}</strong>.
        </div>
      )}

      {results.length > 0 && (
        <div className="library-results-meta">
          {results.length} Treffer für <strong>{initialQuery}</strong>
        </div>
      )}

      <div className="library-grid">
        {results.map((exercise) => (
          <article className="exercise-card" key={exercise.exercise_id ?? exercise.source_key ?? exercise.title}>
            {getThumbnailUrl(exercise) && (
              <div className="exercise-card-thumbnail">
                <img
                  src={getThumbnailUrl(exercise)}
                  alt={`Vorschau für ${exercise.title || 'Übung'}`}
                  loading="lazy"
                />
              </div>
            )}

            <div className="exercise-card-header">
              <h3>{exercise.title || 'Unbenannte Übung'}</h3>
              <span className="exercise-card-players">
                {formatPlayerCount(exercise.players_min, exercise.players_max)}
              </span>
            </div>

            <p className="exercise-card-summary">
              {exercise.summary || 'Für diese Übung liegt keine Zusammenfassung vor.'}
            </p>

            <div className="exercise-card-focus">
              {(exercise.focus ?? []).length > 0 ? (
                exercise.focus.map((item) => (
                  <span className="exercise-chip" key={item}>
                    {item}
                  </span>
                ))
              ) : (
                <span className="exercise-chip exercise-chip-muted">Keine Schwerpunkte</span>
              )}
            </div>

            <div className="exercise-card-actions">
              <button
                className="exercise-card-action"
                type="button"
                onClick={() => handleOpenInEditor(exercise)}
              >
                Im Editor öffnen
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
