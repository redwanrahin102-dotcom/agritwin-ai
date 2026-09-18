# AgriTwin AI

> Digital twin farm simulator — simulate 58 crops across 10 soil types with weather modeling, economic analysis, and AI-powered optimization.

![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

## What is AgriTwin AI?

AgriTwin AI builds a **digital twin** of your farm so you can test farming decisions — irrigation, fertilizer, weather, even the crop itself — before applying them in the real world.

## Features

- **58 Crops** — full agronomic profiles with growth stages, water needs, and market pricing
- **10 Soil Types** — from Sandy to Clay, each with drainage and irrigation characteristics
- **Water Balance Model** — ET₀, Kc, rainfall credit, and net irrigation in physical units (mm, litres)
- **Fuzzy Suitability Scoring** — temperature, humidity, water, soil, and pH matching with limiting-factor penalties
- **What-If Simulator** — live sliders with current vs. simulated comparison
- **250-Strategy Optimizer** — grid search over water × fertilizer, ranked by profit at lower risk
- **Pest & Disease Module** — pathogen-guild model with IPM recommendations
- **Economics Engine** — revenue, costs, ROI, break-even, and price scenarios in 11 currencies
- **8 Weather Scenarios** — heat wave, cold snap, drought, humid surge, and more
- **Season Timeline** — growth-stage progress and days to harvest
- **Action Plan** — daily checklist generated from live model state
- **30-Day Forecast** — health and soil moisture projection charts

## Architecture

```
index.html          Single-page app shell + all CSS
├── logo.js         Logo/favicon fallback chain (head)
├── supabase.js     Database client via Vercel API routes
├── engine.js       Pure agronomic model (no DOM)
├── crops.js        Frozen knowledge base: 58 crops, 10 soils
├── ui.js           HTML widget factories
├── views-farm.js   Home, Create, Dashboard, Simulator, Optimizer
├── views-analysis.js  Crop Advisor, Reports, Methodology
└── app.js          State owner, auth, routing, actions
```

**Data flow:** Strictly unidirectional. Only `app.js` writes to the `state` object. Views are pure functions of state.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (for local dev)
- A [Vercel](https://vercel.com) account (for deployment)
- A Postgres database (Neon, Supabase, or any provider)

### Local Development

```bash
# Clone the repo
git clone https://github.com/redwanrahin102-dotcom/agritwin-ai.git
cd agritwin-ai

# Install dependencies
npm install

# Start local dev server
npm run dev
```

### Database Setup

1. Create a Postgres database and get the connection URL
2. Set environment variables in `public/env.js` or via Vercel:
   - `POSTGRES_URL` — your database connection string
   - `SETUP_SECRET` — a secret for schema initialization
3. Initialize the schema:
   ```bash
   npm run setup-db
   ```
   Or call the API:
   ```bash
   curl -X POST https://yourapp.vercel.app/api/setup \
     -H "Content-Type: application/json" \
     -d '{"secret":"your-set-secret"}'
   ```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Or push to GitHub and import into Vercel — it auto-detects the project.

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth` | POST | Signup, login, session validation |
| `/api/farms` | GET/POST/DELETE | Farm CRUD |
| `/api/activity` | GET/POST | Activity logging |
| `/api/setup` | POST | Database schema initialization |

## Database Schema

```sql
users      → id, email, password_hash, salt, session_token
farms      → id, user_id, name, data (JSONB), timestamps
activity   → id, user_id, kind, message, payload (JSONB), timestamp
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript (ES6+), CSS Grid/Flexbox |
| Backend | Vercel Serverless Functions |
| Database | PostgreSQL (via `@vercel/postgres`) |
| Auth | Token-based (SHA-256 + salt) |
| Hosting | Vercel |
| Fonts | Google Fonts (Poppins + Inter) |

## Model Equations

- **ET₀** = 1.8 + 0.11 × Temperature (mm/day, Hargreaves-style proxy)
- **ETc** = ET₀ × Kc(stage) (FAO-56 crop coefficients)
- **Yield** = baseYield × (health/100)^1.6 (diminishing returns)
- **Suitability** = 30%·temp + 25%·water + 25%·soil + 20%·humidity (with limiting-factor penalty)
- **Optimizer Score** = revenue − water cost − fertilizer cost − risk penalty

## Limitations

- Demo-scale calibration — internally consistent but not validated against field trials
- Simplified ET₀ (temperature only, no wind/humidity/solar)
- No site-specific soil test or local weather feed
- Pest risk is an index, not a diagnosis
- Market prices and FX rates are indicative — replace with local data

## License

MIT

---

**AgriTwin AI** — Simulate Your Farm. Optimize Your Future.
