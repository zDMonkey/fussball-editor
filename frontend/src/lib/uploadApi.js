const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

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

export async function uploadFileToS3(uploadUrl, file) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/pdf',
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload fehlgeschlagen (${response.status})`);
  }
}
