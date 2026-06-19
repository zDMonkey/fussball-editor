import { pool } from '../db/pool.js';

// ── Übungen auflisten (eigene Bibliothek, mit optionalem Kategorie-Filter) ──
export async function listExercises(req, res) {
  const { category, search } = req.query;

  const conditions = [];
  const params = [];

  if (category) {
    params.push(category);
    conditions.push(`
      EXISTS (
        SELECT 1 FROM exercise_categories ec
        JOIN categories c ON c.id = ec.category_id
        WHERE ec.exercise_id = e.id AND c.name = $${params.length}
      )
    `);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `
    SELECT
      e.id, e.title, e.description, e.age_group, e.duration_minutes,
      e.field_template, e.thumbnail_url, e.thumbnail_key, e.share_enabled, e.share_token,
      e.export_status, e.export_url, e.created_at, e.updated_at,
      u.display_name AS created_by_name,
      COALESCE(
        json_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), '[]'
      ) AS categories
    FROM exercises e
    LEFT JOIN users u ON u.id = e.created_by
    LEFT JOIN exercise_categories ec ON ec.exercise_id = e.id
    LEFT JOIN categories c ON c.id = ec.category_id
    ${where}
    GROUP BY e.id, u.display_name
    ORDER BY e.updated_at DESC
    `,
    params
  );

  res.json(rows);
}

export async function getExercise(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT * FROM exercises WHERE id = $1', [id]);

  if (!rows[0]) {
    return res.status(404).json({ error: 'Übung nicht gefunden.' });
  }

  res.json(rows[0]);
}

export async function createExercise(req, res) {
  const { title, description, age_group, duration_minutes, field_template, choreography, thumbnail_key, category_ids } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Titel ist erforderlich.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO exercises
        (title, description, age_group, duration_minutes, field_template, choreography, thumbnail_key, created_by)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'vollfeld_hoch'), COALESCE($6, '{"objects": [], "keyframes": []}'), $7, $8)
       RETURNING *`,
      [title, description, age_group, duration_minutes, field_template, choreography, thumbnail_key, req.user.id]
    );

    const exercise = rows[0];

    if (Array.isArray(category_ids) && category_ids.length > 0) {
      const values = category_ids.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO exercise_categories (exercise_id, category_id) VALUES ${values}`,
        [exercise.id, ...category_ids]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(exercise);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateExercise(req, res) {
  const { id } = req.params;
  const { title, description, age_group, duration_minutes, field_template, choreography, thumbnail_key } = req.body;

  const { rows } = await pool.query(
    `UPDATE exercises SET
       title = COALESCE($1, title),
       description = COALESCE($2, description),
       age_group = COALESCE($3, age_group),
       duration_minutes = COALESCE($4, duration_minutes),
       field_template = COALESCE($5, field_template),
       choreography = COALESCE($6, choreography),
       thumbnail_key = COALESCE($7, thumbnail_key)
     WHERE id = $8
     RETURNING *`,
    [title, description, age_group, duration_minutes, field_template, choreography, thumbnail_key, id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Übung nicht gefunden.' });
  }

  res.json(rows[0]);
}

export async function deleteExercise(req, res) {
  const { id } = req.params;
  const result = await pool.query('DELETE FROM exercises WHERE id = $1', [id]);

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Übung nicht gefunden.' });
  }

  res.status(204).send();
}

// ── Sharing ──────────────────────────────────────────────────────────────

export async function toggleShare(req, res) {
  const { id } = req.params;
  const { enabled } = req.body;

  const { rows } = await pool.query(
    `UPDATE exercises SET share_enabled = $1 WHERE id = $2 RETURNING id, share_token, share_enabled`,
    [Boolean(enabled), id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Übung nicht gefunden.' });
  }

  res.json(rows[0]);
}

// Öffentlicher Abruf per Share-Token — bewusst ohne requireAuth-Middleware,
// damit Trainerkollegen den Link ohne Login öffnen können.
export async function getSharedExercise(req, res) {
  const { token } = req.params;

  const { rows } = await pool.query(
    `SELECT id, title, description, age_group, duration_minutes,
            field_template, choreography, thumbnail_key, export_url, export_status
     FROM exercises
     WHERE share_token = $1 AND share_enabled = true`,
    [token]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Übung nicht gefunden oder Link nicht mehr aktiv.' });
  }

  res.json(rows[0]);
}
