BEGIN;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS is_analista boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS dm_powerbi_segmento (
  id serial PRIMARY KEY,
  titulo varchar(120) NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dm_powerbi_painel (
  id serial PRIMARY KEY,
  segmento_id integer NOT NULL REFERENCES dm_powerbi_segmento(id) ON DELETE CASCADE,
  titulo varchar(120) NOT NULL,
  url text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dm_powerbi_painel_segmento_idx ON dm_powerbi_painel(segmento_id);
COMMIT;
