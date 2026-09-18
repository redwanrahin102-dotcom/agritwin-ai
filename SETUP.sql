-- =====================================================================
-- AgriTwin AI — Vercel Postgres Database Schema
-- =====================================================================
-- Run this ONCE in your database SQL editor, or use:
--   POST /api/setup { "secret": "your-set-secret" }
--   (after setting SETUP_SECRET in Vercel env vars)
-- =====================================================================

-- 1. Users table (simple token-based auth)
create table if not exists users (
  id              uuid primary key default gen_random_uuid(),
  email           text unique not null,
  password_hash   text not null,
  salt            text not null,
  session_token   text,
  created_at      timestamptz default now()
);

-- 2. Farms table (one row per user's digital twin)
create table if not exists farms (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade not null,
  name       text not null default 'My Farm',
  data       jsonb not null,           -- the full farm object (all fields)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Activity log (optional — tracks simulations, crop switches, etc.)
create table if not exists activity (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade not null,
  kind       text not null default 'EVENT',   -- FARM_CREATED, SIMULATION, CROP_SWITCH, etc.
  message    text not null default '',
  payload    jsonb,
  created_at timestamptz default now()
);

-- 4. Indexes for fast lookups
create index if not exists idx_farms_user       on farms (user_id);
create index if not exists idx_activity_user    on activity (user_id, created_at desc);

-- 5. Auto-update the updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger farms_updated_at
  before update on farms
  for each row execute function update_updated_at();
