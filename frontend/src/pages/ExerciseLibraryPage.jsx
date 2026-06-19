import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { deleteExercise, listExercisesFiltered } from '../lib/exerciseApi';
import { mapSearchResultToExerciseTemplate, mapStoredExerciseToExerciseTemplate } from '../lib/exerciseTemplate';

const EXERCISE_SEARCH_API = 'https://b5zb58pdy4.execute-api.eu-north-1.amazonaws.com/prod/search';
const THUMBNAIL_BASE_URL = (import.meta.env.VITE_THUMBNAIL_BASE_URL || '').replace(/\/$/, '');

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
  const directThumbnailUrl = exercise.thumbnail_url ?? exercise.thumbnailUrl ?? '';
  const thumbnailKey = exercise.thumbnail_key ?? exercise.thumbnailKey ?? '';

  if (directThumbnailUrl) return directThumbnailUrl;
  if (!thumbnailKey) return '';
  if (thumbnailKey.startsWith('http://') || thumbnailKey.startsWith('https://') || thumbnailKey.startsWith('/')) {
    return thumbnailKey;
  }

  if (!THUMBNAIL_BASE_URL) {
    return '';
  }

  return `${THUMBNAIL_BASE_URL}/${thumbnailKey.replace(/^\//, '')}`;
}

function normalizeLocalExercise(exercise) {
  const focus = Array.isArray(exercise.focus)
    ? exercise.focus
    : Array.isArray(exercise.choreography?.meta?.focus)
    ? exercise.choreography.meta.focus
    : [];

  return {
    ...exercise,
    resultType: 'local',
    sourceLabel: 'Eigene Übung',
    summary: exercise.description ?? '',
    focus,
    players_min: null,
    players_max: null,
  };
}

function normalizeExternalExercise(exercise) {
  return {
    ...exercise,
    resultType: 'external',
    sourceLabel: 'Importiert',
  };
}

export default function ExerciseLibraryPage({ onOpenInEditor = () => {} }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasQueryParam = searchParams.has('q');
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [externalResults, setExternalResults] = useState([]);
  const [localResults, setLocalResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(hasQueryParam);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const trimmedQuery = initialQuery.trim();
    if (!hasQueryParam) {
      setExternalResults([]);
      setLocalResults([]);
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
        const queryString = hasQueryParam ? `?q=${encodeURIComponent(trimmedQuery)}` : '';
        const response = await fetch(`${EXERCISE_SEARCH_API}${queryString}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API-Fehler (${response.status})`);
        }

        const payload = await response.json();
        const nextExternalResults = normalizeResults(payload).map(normalizeExternalExercise);
        const token = window.localStorage.getItem('token');
        let nextLocalResults = [];

        if (token) {
          const localPayload = await listExercisesFiltered({ search: trimmedQuery });
          nextLocalResults = (Array.isArray(localPayload) ? localPayload : []).map(normalizeLocalExercise);
        }

        setExternalResults(nextExternalResults);
        setLocalResults(nextLocalResults);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setExternalResults([]);
        setLocalResults([]);
        setError('Die Übungssuche ist aktuell nicht erreichbar.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadExercises();

    return () => controller.abort();
  }, [hasQueryParam, initialQuery]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSearchParams({ q: query.trim() });
  };

  const handleOpenInEditor = (exercise) => {
    const template = exercise.resultType === 'local'
      ? mapStoredExerciseToExerciseTemplate(exercise)
      : mapSearchResultToExerciseTemplate(exercise);

    onOpenInEditor(template);
    navigate('/editor');
  };

  const handleDelete = async (exercise) => {
    if (exercise.resultType !== 'local') {
      return;
    }

    if (!window.confirm('Übung wirklich löschen?')) {
      return;
    }

    setDeletingId(exercise.id);
    setError('');

    try {
      await deleteExercise(exercise.id);
      setLocalResults((current) => current.filter((item) => item.id !== exercise.id));
    } catch (deleteError) {
      setError(deleteError.message || 'Übung konnte nicht gelöscht werden.');
    } finally {
      setDeletingId(null);
    }
  };

  const results = [...localResults, ...externalResults];

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
            <button
              className="library-search-button library-search-button-secondary"
              type="button"
              onClick={() => setSearchParams({ q: '' })}
              disabled={loading}
            >
              Alle anzeigen
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
            {getThumbnailUrl(exercise) ? (
              <div className={`exercise-card-thumbnail${exercise.resultType === 'local' ? ' exercise-card-thumbnail-portrait' : ''}`}>
                <img
                  src={getThumbnailUrl(exercise)}
                  alt={`Vorschau für ${exercise.title || 'Übung'}`}
                  loading="lazy"
                />
              </div>
            ) : (
              <div
                className={`exercise-card-thumbnail exercise-card-thumbnail-placeholder${exercise.resultType === 'local' ? ' exercise-card-thumbnail-portrait' : ''}`}
                aria-hidden="true"
              >
                <span>Keine Vorschau</span>
              </div>
            )}

            <div className="exercise-card-header">
              <h3>{exercise.title || 'Unbenannte Übung'}</h3>
              <div className="my-exercise-meta-row">
                <span className="exercise-card-players">
                  {exercise.resultType === 'local'
                    ? (exercise.age_group || 'Eigene Übung')
                    : formatPlayerCount(exercise.players_min, exercise.players_max)}
                </span>
                <span className="exercise-chip exercise-chip-muted">{exercise.sourceLabel}</span>
              </div>
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
              {exercise.resultType === 'local' && (
                <button
                  className="exercise-card-action exercise-card-action-danger"
                  type="button"
                  onClick={() => handleDelete(exercise)}
                  disabled={deletingId === exercise.id}
                >
                  {deletingId === exercise.id ? 'Löscht...' : 'Löschen'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
