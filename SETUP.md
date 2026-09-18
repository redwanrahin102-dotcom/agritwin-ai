# AgriTwin AI — Setup Guide

## 1. Create a Supabase project (free)

1. Go to https://app.supabase.com and sign up / log in
2. Click **"New project"** — give it a name (e.g. `agritwin`)
3. Pick a region close to your users
4. Set a database password (save it somewhere)
5. Wait ~30 seconds for the project to spin up

## 2. Create the database tables

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `SETUP.sql` in this repo, copy its contents, and paste them in
4. Click **"Run"** — you should see "Success. No rows returned"

You now have a `farms` table and an `activity` table, both locked to each user via row-level security.

## 3. Get your API credentials

1. In Supabase, go to **Project Settings** (gear icon, bottom-left)
2. Click **"API"** in the sidebar
3. Copy two values:
   - **Project URL** — looks like `https://xyzcompany.supabase.co`
   - **Anon key** — a long string starting with `eyJ...`

## 4. Configure the app

Open `supabase.js` and replace the two placeholders:

```js
const SUPABASE_URL  = 'https://xyzcompany.supabase.co';  // ← your Project URL
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...'; // ← your Anon key
```

That's it — the app is now connected to Supabase.

## 5. Test locally

```bash
python -m http.server 8123
# Open http://127.0.0.1:8123
```

- Click **"👤 Guest"** in the navbar → **Sign up** with an email
- Create a farm → it saves to Supabase AND localStorage
- Close the browser, open again → log in → your farm is still there

## 6. Deploy to Vercel

1. Push this folder to a Git repo (GitHub, GitLab, or Bitbucket)
2. Go to https://vercel.com and import the repo
3. Framework preset: **"Other"** (no build step needed)
4. Click **Deploy** — it's live in ~30 seconds

### Optional: hide credentials in Vercel

Instead of editing `supabase.js` directly, you can inject env vars at deploy time:

1. In Vercel dashboard → your project → **Settings** → **Environment Variables**
2. Add:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_ANON` = your anon key
3. Create a file `public/env.js` that Vercel serves at the root:
   ```js
   window.ENV = { SUPABASE_URL: '__SUPABASE_URL__', SUPABASE_ANON: '__SUPABASE_ANON__' };
   ```
4. Vercel automatically replaces `__VAR__` placeholders with env values at build time

## 7. Custom domain (optional)

In Vercel → your project → **Settings** → **Domains** → add your domain.

---

## How it works

| Mode | Auth | Storage | Sync |
|------|------|---------|------|
| **Guest** | None | `localStorage` | No |
| **Logged in** | Supabase Auth | `localStorage` + Supabase | Yes (manual — refresh to sync) |

When logged in, `saveFarm()` writes to both localStorage (instant, always works) and Supabase (synced to the cloud). `loadFarm()` reads Supabase first, falls back to localStorage. This means:
- Offline? localStorage keeps working.
- Multiple devices? Log in on both → farms sync via Supabase.
- Clear browser data? Supabase has your farm backed up.
