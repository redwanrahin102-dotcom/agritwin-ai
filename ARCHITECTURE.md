# AgriTwin AI — code structure

One digital-twin model, three source builds merged. No build step: plain
script tags, open `index.html`. Deploys to Vercel (static hosting).

## Files, in load order

| file | owns | must not |
|---|---|---|
| `logo.js` (head) | logo/favicon fallback chain | touch state |
| `supabase.js` | Supabase client init + auth helpers + farm CRUD via DB | touch app state |
| `engine.js` | the physical model + domain constants + legacy-engine tables | read DOM/state/storage |
| `crops.js` | 58 frozen crops, soils, stages, weather, Kc profiles | mutate records |
| `ui.js` | formatting + shared widgets (gauge, yield bars, sort bar, narrative) | read DOM |
| `views-farm.js` | `viewHome`, `viewCreate`, `viewDashboard`, `viewSimulator`, `viewOptimizer` | write state |
| `views-analysis.js` | `viewAdvisor`, `viewReports`, `viewMethod` | write state |
| `app.js` | `state`, auth gating, routing, create-form actions, chrome (modal, toast) | render layers |

`logo.js` is in `<head>` because the navbar `<img>` fires `onerror` before body
scripts parse. `engine.js` loads before `crops.js` because the knowledge base
derives each crop record with engine constants at load time.

## Auth + database (Supabase)

The app works in two modes:

- **Guest** — everything stored in `localStorage`. No account needed.
- **Logged in** — farms synced to Supabase Postgres via the client SDK.
  Auth handled by `supabase.auth.signUp / signInWithPassword`.

To configure: open `supabase.js` and replace the two placeholder constants
(`SUPABASE_URL`, `SUPABASE_ANON`) with your Supabase project credentials.
Find them at https://app.supabase.com → Project Settings → API.

### Database schema (run once in the SQL editor)

```sql
create table if not exists farms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table farms enable row level security;
create policy "Users can CRUD their own farms"
  on farms for all using (auth.uid() = user_id);
```

## Invariants for later passes

- **One owner per piece of state.** `state` (app.js) holds farm, sim, weather,
  optimizer run + timer + phase, sort mode, tasks, display currency, view and
  direction. `setFarm()` is the only writer of `state.farm`. `clearRuns()`
  drops everything derived and cancels in-flight optimizers.
- **Money has one source.** `state.currency` is mirrored from the farm by
  `setFarm`; `money(v,cur)` falls back to it.
- **Tables sort through `setSort()`** for both Create and Crop Advisor.
- **Prose composed in `ui.js`**, numbers from `engine.js` — the pest module
  returns guild numbers only; `pestNarrative()` turns them into the shared
  risk list and management plan.
- **Auth gating:** unauthenticated users see all layers but guest-only data.
  Logged-in users get Supabase-synced farms. The auth chip in the navbar
  controls the flow.

## Vercel deployment

1. Push this folder to a Git repo.
2. Import into Vercel — no build command needed (pure static).
3. Optional: set `SUPABASE_URL` and `SUPABASE_ANON` as Vercel env vars
   and expose them via a `/env.js` script tag for zero-edit deploys.
4. `vercel.json` provides SPA rewrites and security headers.

## Verification

Serve locally (`python -m http.server 8123`) to test the module-split.
`node --check` on each `.js` file. Browser: all 8 layers render, engine
parity against baseline (health 90, suitability 94%, ৳777,429/yr at 45%
margin, 19,440 L/day, 504 mm/cycle, pest 11%), 58 crop rows, auth view
with login form + guest fallback, 0 px overflow after animation.
