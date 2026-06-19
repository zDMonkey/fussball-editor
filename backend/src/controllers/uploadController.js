import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOAD_BUCKET = 'football-exercises-pdf-027825871321-eu-north-1-an';
const AWS_REGION = process.env.AWS_REGION || 'eu-north-1';
const PRESIGN_EXPIRES_IN = 900;

const s3Client = new S3Client({ region: AWS_REGION });

function isPdfUpload(filename = '', contentType = '') {
  return contentType === 'application/pdf' && filename.toLowerCase().endsWith('.pdf');
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

  return `uploads/pdfs/${year}/${month}/${day}/${randomUUID()}-${safeFilename}`;
}

export async function createPresignedUpload(req, res) {
  const { filename, contentType } = req.body ?? {};

  if (!filename || !contentType) {
    return res.status(400).json({ error: 'filename und contentType sind erforderlich.' });
  }

  if (!isPdfUpload(filename, contentType)) {
    return res.status(400).json({ error: 'Es sind nur PDF-Dateien erlaubt.' });
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
