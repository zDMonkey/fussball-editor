import { useMemo, useState } from 'react';
import { createUploadPresign, resolveUploadContentType, uploadFileToS3 } from '../lib/uploadApi';

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

  return {
    id: `${file.name}-${file.lastModified}-${file.size}`,
    file,
    status: isSupported ? 'Bereit' : 'Ungültiger Dateityp',
    message: isSupported ? '' : 'Erlaubt sind PDF-, PNG- und JPEG-Dateien.',
    objectKey: '',
  };
}

export default function PdfUploadPage() {
  const [uploads, setUploads] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const validUploads = useMemo(
    () => uploads.filter((entry) => isSupportedImportFile(entry.file)),
    [uploads]
  );

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files ?? []);
    setUploads(files.map(createUploadEntry));
  };

  const updateUpload = (id, changes) => {
    setUploads((current) => current.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)));
  };

  const handleUploadAll = async () => {
    setIsUploading(true);

    for (const entry of validUploads) {
      try {
        updateUpload(entry.id, { status: 'Signierung läuft', message: '' });
        const contentType = resolveUploadContentType(entry.file);

        const presign = await createUploadPresign({
          filename: entry.file.name,
          contentType,
        });

        updateUpload(entry.id, {
          status: 'Upload läuft',
          objectKey: presign.objectKey,
        });

        await uploadFileToS3(presign.uploadUrl, entry.file, contentType);

        updateUpload(entry.id, {
          status: 'Hochgeladen – Verarbeitung läuft',
          message: presign.objectKey,
        });
      } catch (error) {
        updateUpload(entry.id, {
          status: 'Fehler',
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
              <div className="pdf-upload-status">{entry.status}</div>
              {entry.message && <div className="pdf-upload-message">{entry.message}</div>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
