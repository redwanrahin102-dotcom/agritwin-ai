import { sql } from '@vercel/postgres';
import { config } from 'dotenv';

config();

async function setup() {
  console.log('Setting up database schema...');
  
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
  console.log('✓ users table');

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
  console.log('✓ farms table');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id)
  `;
  console.log('✓ farms index');

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
  console.log('✓ activity table');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_activity_user_created 
      ON activity(user_id, created_at DESC)
  `;
  console.log('✓ activity index');

  await sql`
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql'
  `;

  try {
    await sql`DROP TRIGGER IF EXISTS update_farms_updated_at ON farms`;
    await sql`
      CREATE TRIGGER update_farms_updated_at
        BEFORE UPDATE ON farms
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at()
    `;
    console.log('✓ updated_at trigger');
  } catch (e) {
    console.log('⚠ trigger setup skipped (may need manual setup)');
  }

  console.log('\nDatabase setup complete!');
}

setup().catch(console.error);
