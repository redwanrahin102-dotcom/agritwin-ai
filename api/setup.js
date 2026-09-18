import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { secret } = req.body;
  if (secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        session_token TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS farms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        name TEXT NOT NULL DEFAULT 'My Farm',
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // RLS not needed — API routes handle user_id filtering directly

    await sql`
      CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        kind TEXT NOT NULL DEFAULT 'EVENT',
        message TEXT NOT NULL DEFAULT '',
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_activity_user_created
        ON activity(user_id, created_at DESC)
    `;

    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `;

    await sql`DROP TRIGGER IF EXISTS update_farms_updated_at ON farms`;

    await sql`
      CREATE TRIGGER update_farms_updated_at
        BEFORE UPDATE ON farms
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at()
    `;

    return res.status(200).json({ ok: true, message: 'Database schema created successfully' });
  } catch (error) {
    console.error('Setup error:', error);
    return res.status(500).json({ error: error.message });
  }
}
