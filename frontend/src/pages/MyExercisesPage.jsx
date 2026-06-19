import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteExercise, listExercises } from '../lib/exerciseApi';
import { mapStoredExerciseToExerciseTemplate } from '../lib/exerciseTemplate';

function formatDuration(value) {
  return Number.isFinite(value) ? `${value} Min.` : 'Keine Dauer';
}

function getThumbnailUrl(exercise) {
  return exercise.thumbnail_url ?? '';
}

function getFocus(exercise) {
  if (Array.isArray(exercise.focus)) {
    return exercise.focus;
  }

  if (Array.isArray(exercise.choreography?.meta?.focus)) {
    return exercise.choreography.meta.focus.filter(Boolean);
  }

  return [];
}

export default function MyExercisesPage({ onOpenInEditor = () => {} }) {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadExercises() {
      setLoading(true);
      setError('');

      try {
        const response = await listExercises();
        if (!active) return;
        setExercises(Array.isArray(response) ? response : []);
      } catch (loadError) {
        if (!active) return;
        setExercises([]);
        setError(loadError.message || 'Meine Übungen konnten nicht geladen werden.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadExercises();

    return () => {
      active = false;
    };
  }, []);

  const handleOpenInEditor = (exercise) => {
    // Lokal gespeicherte Uebungen enthalten bereits eine persistierte
    // choreography und koennen deshalb vollstaendig in den Editor
    // zurueckhydriert werden.
    const template = mapStoredExerciseToExerciseTemplate(exercise);
    onOpenInEditor(template);
    navigate('/editor');
  };

  const handleDelete = async (exercise) => {
    if (!window.confirm('Übung wirklich löschen?')) {
      return;
    }

    setDeletingId(exercise.id);
    setError('');

    try {
      await deleteExercise(exercise.id);
      setExercises((current) => current.filter((item) => item.id !== exercise.id));
    } catch (deleteError) {
      setError(deleteError.message || 'Übung konnte nicht gelöscht werden.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="library-page">
      <div className="library-hero">
        <div>
          <p className="library-eyebrow">Lokale Übungen</p>
          <h2>Meine Übungen</h2>
          <p className="library-intro">
            Hier siehst du deine im lokalen Backend gespeicherten Editor-Dokumente und kannst sie erneut öffnen.
          </p>
        </div>
      </div>

      {loading && <div className="library-state">Übungen werden geladen...</div>}
      {!loading && error && <div className="library-state library-state-error">{error}</div>}
      {!loading && !error && exercises.length === 0 && (
        <div className="library-state">Es sind noch keine gespeicherten Übungen vorhanden.</div>
      )}

      {!loading && !error && exercises.length > 0 && (
        <div className="library-results-meta">{exercises.length} gespeicherte Übungen</div>
      )}

      <div className="library-grid">
        {exercises.map((exercise) => (
          <article className="exercise-card" key={exercise.id}>
            {getThumbnailUrl(exercise) ? (
              <div className="exercise-card-thumbnail exercise-card-thumbnail-portrait">
                <img
                  src={getThumbnailUrl(exercise)}
                  alt={`Vorschau für ${exercise.title || 'Übung'}`}
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="exercise-card-thumbnail exercise-card-thumbnail-placeholder exercise-card-thumbnail-portrait" aria-hidden="true">
                <span>Keine Vorschau</span>
              </div>
            )}

            <div className="exercise-card-header">
              <h3>{exercise.title || 'Unbenannte Übung'}</h3>
              <div className="my-exercise-meta-row">
                <span className="exercise-card-players">{exercise.age_group || 'Keine Altersklasse'}</span>
                <span className="exercise-chip exercise-chip-muted">{formatDuration(exercise.duration_minutes)}</span>
              </div>
            </div>

            <p className="exercise-card-summary">
              {exercise.description || 'Für diese Übung liegt keine Beschreibung vor.'}
            </p>

            <div className="exercise-card-focus">
              {getFocus(exercise).length > 0 ? (
                getFocus(exercise).map((item) => (
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
              <button
                className="exercise-card-action exercise-card-action-danger"
                type="button"
                onClick={() => handleDelete(exercise)}
                disabled={deletingId === exercise.id}
              >
                {deletingId === exercise.id ? 'Löscht...' : 'Löschen'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
