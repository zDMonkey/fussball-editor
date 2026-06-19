const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const FALLBACK_CONTENT_TYPE_BY_EXTENSION = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function getAuthHeaders() {
  const token = window.localStorage.getItem('token');

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

export async function createUploadPresign({ filename, contentType }) {
  const response = await fetch(`${API_BASE_URL}/api/uploads/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ filename, contentType }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error || `API-Fehler (${response.status})`);
  }

  return body;
}

export function resolveUploadContentType(file) {
  if (file?.type && Object.values(FALLBACK_CONTENT_TYPE_BY_EXTENSION).includes(file.type)) {
    return file.type;
  }

  const lowercaseName = file?.name?.toLowerCase?.() ?? '';
  const extension = Object.keys(FALLBACK_CONTENT_TYPE_BY_EXTENSION)
    .find((candidate) => lowercaseName.endsWith(candidate));

  return extension ? FALLBACK_CONTENT_TYPE_BY_EXTENSION[extension] : '';
}

export async function uploadFileToS3(uploadUrl, file, contentType = resolveUploadContentType(file)) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload fehlgeschlagen (${response.status})`);
  }
}
