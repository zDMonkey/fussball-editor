import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mapSearchResultToExerciseTemplate } from '../lib/exerciseTemplate';
import { searchExercises } from '../lib/exerciseSearchApi';

const THUMBNAIL_BASE_URL = (import.meta.env.VITE_THUMBNAIL_BASE_URL || '').replace(/\/$/, '');

function formatPlayerCount(min, max) {
  if (Number.isFinite(min) && Number.isFinite(max)) {
    return min === max ? `${min} Spieler` : `${min}-${max} Spieler`;
  }
  if (Number.isFinite(min)) return `Ab ${min} Spielern`;
  if (Number.isFinite(max)) return `Bis ${max} Spieler`;
  return 'Keine Angabe';
}

function formatExerciseDate(exercise) {
  // Externe/importierte Treffer und lokale Exercises nutzen aktuell
  // dieselbe Anzeige-Regel: created_at bevorzugen, sonst updated_at.
  const rawValue = exercise.created_at ?? exercise.updated_at ?? exercise.createdAt ?? exercise.updatedAt ?? '';
  if (!rawValue) return '';

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

function normalizeExternalExercise(exercise) {
  // Externe Suchtreffer bleiben bewusst flach. Die Bibliothek braucht hier
  // nur genug Meta-Daten fuer Kartenansicht und Editor-Handoff.
  return {
    ...exercise,
    resultType: 'external',
    sourceLabel: 'Importiert',
  };
}

export default function ExerciseLibraryPage({ onOpenInEditor = () => {} }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    searchExercises(initialQuery)
      .then((data) => {
        if (!active) return;
        setResults(data.map(normalizeExternalExercise));
      })
      .catch((err) => {
        if (!active) return;
        setResults([]);
        setError(err.message || 'Übungen konnten nicht geladen werden.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [initialQuery]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSearchParams(query.trim() ? { q: query.trim() } : {});
  };

  const handleShowAll = () => {
    setQuery('');
    setSearchParams({});
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
          <p className="library-eyebrow">Importierte Übungen</p>
          <h2>Übungsbibliothek</h2>
          <p className="library-intro">
            Durchsuche importierte Übungen aus der Search API und öffne sie als Vorlage direkt im Editor.
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Titel, Beschreibung oder Schwerpunkt"
            />
            <button className="library-search-button" type="submit" disabled={loading}>
              {loading ? 'Suche läuft…' : 'Suchen'}
            </button>
            <button
              className="library-search-button library-search-button-secondary"
              type="button"
              onClick={handleShowAll}
              disabled={loading}
            >
              Alle anzeigen
            </button>
          </div>
        </form>
      </div>

      {error && <div className="library-state library-state-error">{error}</div>}

      {!error && loading && <div className="library-state">Lädt…</div>}

      {!error && !loading && results.length === 0 && (
        <div className="library-state">
          {initialQuery
            ? <>Keine Treffer für <strong>{initialQuery}</strong>.</>
            : 'Keine importierten Übungen gefunden.'}
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <div className="library-results-meta">
            {results.length} {results.length === 1 ? 'Übung' : 'Übungen'}
            {initialQuery && <> für <strong>{initialQuery}</strong></>}
          </div>

          <div className="library-grid">
            {results.map((exercise) => (
              <article className="exercise-card" key={exercise.exercise_id ?? exercise.source_key ?? exercise.title}>
                {getThumbnailUrl(exercise) ? (
                  <div className="exercise-card-thumbnail">
                    <img
                      src={getThumbnailUrl(exercise)}
                      alt={`Vorschau für ${exercise.title || 'Übung'}`}
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div
                    className="exercise-card-thumbnail exercise-card-thumbnail-placeholder"
                    aria-hidden="true"
                  >
                    <span>Keine Vorschau</span>
                  </div>
                )}

                <div className="exercise-card-header">
                  <h3>{exercise.title || 'Unbenannte Übung'}</h3>
                  <div className="my-exercise-meta-row">
                    <span className="exercise-card-players">
                      {formatPlayerCount(exercise.players_min, exercise.players_max)}
                    </span>
                    <span className="exercise-chip exercise-chip-muted">{exercise.sourceLabel}</span>
                  </div>
                  {formatExerciseDate(exercise) && (
                    <div className="exercise-card-date">
                      {formatExerciseDate(exercise)}
                    </div>
                  )}
                </div>

                <p className="exercise-card-summary">
                  {exercise.summary || exercise.description || 'Für diese Übung liegt keine Zusammenfassung vor.'}
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
        </>
      )}
    </section>
  );
}
