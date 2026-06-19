import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOAD_BUCKET = 'football-exercises-pdf-027825871321-eu-north-1-an';
const AWS_REGION = process.env.AWS_REGION || 'eu-north-1';
const PRESIGN_EXPIRES_IN = 900;
const ALLOWED_UPLOAD_TYPES = new Map([
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
]);

const s3Client = new S3Client({ region: AWS_REGION });

function getFileExtension(filename = '') {
  const normalized = filename.toLowerCase();

  if (normalized.endsWith('.jpeg')) return '.jpeg';
  if (normalized.endsWith('.jpg')) return '.jpg';
  if (normalized.endsWith('.png')) return '.png';
  if (normalized.endsWith('.pdf')) return '.pdf';

  return '';
}

function isSupportedUpload(filename = '', contentType = '') {
  const extension = getFileExtension(filename);
  const expectedContentType = ALLOWED_UPLOAD_TYPES.get(extension);

  return Boolean(expectedContentType) && contentType === expectedContentType;
}

function sanitizeFilename(filename) {
  return filename
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function buildObjectKey(filename) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const safeFilename = sanitizeFilename(filename);

  return `uploads/files/${year}/${month}/${day}/${randomUUID()}-${safeFilename}`;
}

export async function createPresignedUpload(req, res) {
  const { filename, contentType } = req.body ?? {};

  if (!filename || !contentType) {
    return res.status(400).json({ error: 'filename und contentType sind erforderlich.' });
  }

  if (!isSupportedUpload(filename, contentType)) {
    return res.status(400).json({ error: 'Erlaubt sind nur PDF-, PNG- und JPEG-Dateien.' });
  }

  const objectKey = buildObjectKey(filename);
  const command = new PutObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: PRESIGN_EXPIRES_IN });

  res.status(201).json({
    objectKey,
    uploadUrl,
    expiresIn: PRESIGN_EXPIRES_IN,
  });
}
