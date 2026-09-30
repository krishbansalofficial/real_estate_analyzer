# Real Estate Analyzer

The **Real Estate Analyzer** estimates US home prices from bedrooms, bathrooms, living area, lot
size and location. It is inspired by *The Big Short*, which showed what happens when financial
estimates hide their uncertainty, so every estimate comes with a calibrated range, local context
and comparable homes, and the accuracy is published on the site.

- **Frontend:** React + Vite + Tailwind (`src/`)
- **API:** Node + Express, serving the model with no Python at runtime (`server/`)
- **Model:** gradient-boosted trees trained with scikit-learn (`ml/`)
- **Logging (optional):** PostgreSQL

## Quick start

```bash
# 1. API (port 3000)
cd server
npm install
npm start

# 2. Frontend (port 8080), in another terminal from the repo root
npm install
npm run dev
```

Open http://localhost:8080. In development Vite proxies `/api` to the API, so no environment
variables are needed.

### Optional: Google address search

Copy `.env.example` to `.env` and set `VITE_GOOGLE_MAPS_API_KEY` (Maps JavaScript API + Places).
Restrict the key to your domains in Google Cloud Console. Without a key, the analyzer uses plain
zip/city/state fields.

### Optional: prediction logging

```bash
docker compose up -d                       # Postgres with server/db/schema.sql applied
cp server/.env.example server/.env         # then uncomment DATABASE_URL
```

Predictions are logged by the server, not the browser, so they can't be forged. Set
`ADMIN_TOKEN` to read them with `GET /api/analyzer-log` and header
`Authorization: Bearer <token>`.

## API

| Method | Path | |
| --- | --- | --- |
| `POST` | `/api/predict` | `{ bed, bath, house_size, acre_lot?, zip_code?, city?, state? }` → estimate, 80% range, area stats, comparables |
| `GET` | `/api/model` | held-out accuracy metrics |
| `GET` | `/api/health` | status, model version, logging on/off |
| `GET` | `/api/analyzer-log` | recent predictions (admin token required) |

Inputs outside the training data's range (for example under 300 ft² or more than 12 bedrooms)
are rejected with field-level errors rather than extrapolated. `/api/predict` is rate-limited to
60 requests per minute per IP.

## Model and data

Trained on the [USA Real Estate Dataset](https://www.kaggle.com/datasets/ahmedshahriarsakib/usa-real-estate-dataset)
(Realtor.com listings and sales, 2.2M rows, about 1.5M homes after cleaning). The accuracy on
held-out homes, and how it compares with simpler baselines, is in
[`server/model/metrics.json`](server/model/metrics.json) and on the site's *How it works* page.
See [`ml/README.md`](ml/README.md) for the method and how to retrain.

Known limitations: the model has no information about condition, views, schools or exact
street; many prices are asking prices; and the data isn't adjusted for market changes since it
was collected. It is an educational tool, not an appraisal.

## Tests

```bash
npm test                 # frontend (Vitest)
cd server && npm test    # API + model (node:test), including JS-vs-sklearn parity
npm run lint
```

## Deployment

**Vercel (frontend and API together).** `vercel.json` builds the frontend as usual and serves the
API from `api/index.js`, a serverless function wrapping the same Express app, under `/api/*` on
the same domain. `VITE_API_BASE_URL` stays empty and no CORS setup is needed. It also adds the
SPA fallback so links like `/analyzer` work on refresh.

Optional environment variables in the Vercel project settings:

- `VITE_GOOGLE_MAPS_API_KEY` for address search (restrict it to your domain)
- `DATABASE_URL` for prediction logging with any hosted Postgres (Neon, Supabase, …); run
  `server/db/schema.sql` once. `ADMIN_TOKEN` to read the log.

Rate limiting is per serverless instance, so it's a soft limit on Vercel.

**Any Node host.** `cd server && npm start` works anywhere (it uses about 120 MB of memory). Then
set `VITE_API_BASE_URL` on the frontend, plus `CORS_ORIGIN` and `TRUST_PROXY=1` on the API.

## Future work

- Add features the README originally planned: school ratings, distance to hospitals and police,
  and county economic data ([US County Data](https://www.kaggle.com/datasets/demche/us-county-data-2018-2021),
  [US Schools](https://www.kaggle.com/datasets/andrewmvd/us-schools-dataset),
  [US Hospitals](https://www.kaggle.com/datasets/andrewmvd/us-hospital-locations)). These need
  zip-code centroids to join on.
- Adjust older sale prices to today's market with a house price index.
- Distinguish asking prices from sale prices during training.
