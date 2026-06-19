import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import exerciseRoutes from './routes/exercises.js';
import categoryRoutes from './routes/categories.js';
import uploadRoutes from './routes/uploads.js';

dotenv.config();

const app = express();

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  process.env.FRONTEND_URL,
].filter(Boolean));

const corsOptions = {
  origin(origin, callback) {
    // Requests ohne Origin (z. B. curl/healthchecks) weiterhin erlauben.
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    console.error('Blocked CORS origin:', origin);
    return callback(new Error('CORS: Origin nicht erlaubt.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '5mb' })); // Choreografie-JSON kann größer werden

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/uploads', uploadRoutes);

// Zentrale Fehlerbehandlung
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Interner Serverfehler.' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend läuft auf Port ${port}`);
});
