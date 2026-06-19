import { Router } from 'express';
import { createPresignedUpload } from '../controllers/uploadController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Preflight fuer den direkten Browser-Upload muss ohne Auth beantwortet werden.
router.options('/presign', (_req, res) => res.sendStatus(204));
router.post('/presign', requireAuth, createPresignedUpload);

export default router;
