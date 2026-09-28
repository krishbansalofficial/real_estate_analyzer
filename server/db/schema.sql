-- Prediction log. Applied automatically by docker-compose on first start;
-- otherwise run: psql "$DATABASE_URL" -f server/db/schema.sql
CREATE TABLE IF NOT EXISTS analyzer_log (
  id              SERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  bed             SMALLINT NOT NULL,
  bath            NUMERIC(4, 1) NOT NULL,
  acre_lot        NUMERIC(10, 3),
  house_size      INTEGER NOT NULL,
  city            TEXT,
  state           TEXT,
  zip_code        CHAR(5),
  predicted_price INTEGER NOT NULL,
  price_low       INTEGER,
  price_high      INTEGER,
  location_match  TEXT,
  model_version   TEXT
);

CREATE INDEX IF NOT EXISTS analyzer_log_created_at_idx ON analyzer_log (created_at DESC);
