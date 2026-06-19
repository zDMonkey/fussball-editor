import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createAdmin() {
  const email = 'admin@admin';
  const password = 'Z6cTSKpiiEno3qm0d988';
  const displayName = 'Admin';

  const hash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = $2
     RETURNING id, email, role`,
    [email, hash, displayName]
  );

  console.log('Admin erstellt:', result.rows[0]);
  await pool.end();
}

createAdmin().catch(console.error);
