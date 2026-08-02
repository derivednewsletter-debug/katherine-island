-- Katherine's Island — Neon (serverless Postgres) schema
-- Run this once against your Neon database (psql or the Neon SQL editor).
--
--   psql "$DATABASE_URL" -f db/init.sql

-- One row per player; `state` is the JSON game-save payload the client
-- sends (inventory, needs, growth, shop unlocks, decorations, ...).
CREATE TABLE IF NOT EXISTS saves (
  player     TEXT PRIMARY KEY,
  state      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
