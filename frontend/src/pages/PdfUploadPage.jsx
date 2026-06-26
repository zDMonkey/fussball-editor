import { useEffect, useMemo, useRef, useState } from 'react';
import { createUploadPresign, resolveUploadContentType, uploadFileToS3 } from '../lib/uploadApi';

const EXERCISE_SEARCH_API = 'https://b5zb58pdy4.execute-api.eu-north-1.amazonaws.com/prod/search';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

const STATUS_LABELS = {
  ready: 'Bereit',
  signing: 'Signierung läuft',
  uploading: 'Upload läuft',
  processing: 'Verarbeitung läuft',
  imported: 'Importiert',
  timeout: 'Noch nicht gefunden',
  error: 'Fehler',
  invalid: 'Ungültiger Dateityp',
};

function isSupportedImportFile(file) {
  return Boolean(resolveUploadContentType(file));
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createUploadEntry(file) {
  const isSupported = isSupportedImportFile(file);
  const filenameStem = file.name.replace(/\.[^.]+$/, '');

  return {
    id: `${file.name}-${file.lastModified}-${file.size}`,
    file,
    status: isSupported ? 'ready' : 'invalid',
    message: isSupported ? '' : 'Erlaubt sind PDF-, PNG- und JPEG-Dateien.',
    objectKey: '',
    sourceKey: '',
    filenameStem,
    importedExerciseId: '',
  };
}

function normalizeResults(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function matchesImportedExercise(result, entry) {
  // Das Polling arbeitet absichtlich ohne neue Backend-Infrastruktur.
  // Deshalb pruefen wir pragmatisch mehrere vorhandene Felder:
  // - source_key / objectKey
  // - Dateiname
  // - Dateiname ohne Endung
  const resultSourceKey = result.source_key ?? '';
  const resultTitle = (result.title ?? '').toLowerCase();
  const fileName = entry.file.name.toLowerCase();
  const stem = entry.filenameStem.toLowerCase();

  return (
    resultSourceKey === entry.objectKey
    || resultSourceKey === entry.sourceKey
    || resultSourceKey.endsWith(`/${entry.file.name}`)
    || resultTitle.includes(fileName)
    || (stem && resultTitle.includes(stem))
  );
}

async function searchImportedExercise(query) {
  const response = await fetch(`${EXERCISE_SEARCH_API}?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error(`Search API-Fehler (${response.status})`);
  }

  return normalizeResults(await response.json());
}

export default function PdfUploadPage() {
  const [uploads, setUploads] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  // Pro Upload laeuft maximal ein aktiver Timer. Beim Unmount werden alle
  // Polling-Timer sauber beendet, damit keine spaeten State-Updates mehr kommen.
  const pollingTimeoutsRef = useRef(new Map());

  const validUploads = useMemo(
    () => uploads.filter((entry) => isSupportedImportFile(entry.file)),
    [uploads]
  );

  useEffect(() => () => {
    for (const timeoutId of pollingTimeoutsRef.current.values()) {
      window.clearTimeout(timeoutId);
    }
    pollingTimeoutsRef.current.clear();
  }, []);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files ?? []);
    setUploads(files.map(createUploadEntry));
  };

  const updateUpload = (id, changes) => {
    setUploads((current) => current.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)));
  };

  const schedulePoll = (entry, startedAt = Date.now()) => {
    const poll = async () => {
      try {
        // Wir nutzen bewusst die bestehende Search API als "Importstatus",
        // statt eine separate Status-API einzufuehren.
        const queryCandidates = [entry.objectKey, entry.file.name, entry.filenameStem].filter(Boolean);

        for (const query of queryCandidates) {
          const results = await searchImportedExercise(query);
          const importedExercise = results.find((result) => matchesImportedExercise(result, entry));

          if (importedExercise) {
            pollingTimeoutsRef.current.delete(entry.id);
            updateUpload(entry.id, {
              status: 'imported',
              importedExerciseId: importedExercise.exercise_id ?? importedExercise.id ?? '',
              message: importedExercise.title
                ? `Importiert: ${importedExercise.title}`
                : 'Importiert und in der Bibliothek gefunden.',
            });
            return;
          }
        }

        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          pollingTimeoutsRef.current.delete(entry.id);
          updateUpload(entry.id, {
            status: 'timeout',
            message: 'Hochgeladen, aber noch nicht in der Bibliothek gefunden.',
          });
          return;
        }

        const timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS);
        pollingTimeoutsRef.current.set(entry.id, timeoutId);
      } catch (error) {
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          pollingTimeoutsRef.current.delete(entry.id);
          updateUpload(entry.id, {
            status: 'timeout',
            message: 'Hochgeladen, aber noch nicht in der Bibliothek gefunden.',
          });
          return;
        }

        const timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS);
        pollingTimeoutsRef.current.set(entry.id, timeoutId);
      }
    };

    poll();
  };

  const handleUploadAll = async () => {
    setIsUploading(true);

    for (const entry of validUploads) {
      try {
        updateUpload(entry.id, { status: 'signing', message: '' });
        const contentType = resolveUploadContentType(entry.file);

        const presign = await createUploadPresign({
          filename: entry.file.name,
          contentType,
        });

        updateUpload(entry.id, {
          status: 'uploading',
          objectKey: presign.objectKey,
          sourceKey: presign.objectKey,
        });

        await uploadFileToS3(presign.uploadUrl, entry.file, contentType);

        updateUpload(entry.id, {
          status: 'processing',
          message: presign.objectKey,
        });

        // Erst nach erfolgreichem S3-PUT startet das Polling. Davor gibt es
        // fuer die Import-Pipeline noch nichts, was in der Suche auftauchen koennte.
        schedulePoll({
          ...entry,
          objectKey: presign.objectKey,
          sourceKey: presign.objectKey,
        });
      } catch (error) {
        updateUpload(entry.id, {
          status: 'error',
          message: error.message || 'Upload fehlgeschlagen.',
        });
      }
    }

    setIsUploading(false);
  };

  return (
    <section className="library-page">
      <div className="library-hero">
        <div>
          <p className="library-eyebrow">Direktimport</p>
          <h2>Datei-Import</h2>
          <p className="library-intro">
            Wähle mehrere Übungsdateien aus und lade sie direkt nach S3 hoch. Die bestehende Import-Pipeline startet danach automatisch.
          </p>
        </div>

        <div className="library-search pdf-upload-panel">
          <label className="library-search-label" htmlFor="pdf-upload-input">
            Dateien auswählen
          </label>
          <input
            id="pdf-upload-input"
            className="pdf-upload-input"
            type="file"
            accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
            multiple
            onChange={handleFileChange}
          />
          <button
            className="library-search-button"
            type="button"
            onClick={handleUploadAll}
            disabled={isUploading || validUploads.length === 0}
          >
            {isUploading ? 'Uploads laufen...' : 'Alle hochladen'}
          </button>
        </div>
      </div>

      {uploads.length === 0 && (
        <div className="library-state">Noch keine Dateien ausgewählt. Erlaubt sind PDF, PNG, JPG und JPEG.</div>
      )}

      {uploads.length > 0 && (
        <div className="pdf-upload-list">
          {uploads.map((entry) => (
            <article className="pdf-upload-item" key={entry.id}>
              <div className="pdf-upload-head">
                <strong>{entry.file.name}</strong>
                <span>{formatFileSize(entry.file.size)}</span>
              </div>
              <div className="pdf-upload-status">{STATUS_LABELS[entry.status] ?? entry.status}</div>
              {entry.message && <div className="pdf-upload-message">{entry.message}</div>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
