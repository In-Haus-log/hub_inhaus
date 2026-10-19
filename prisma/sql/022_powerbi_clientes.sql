BEGIN;
ALTER TABLE dm_powerbi_segmento ADD COLUMN IF NOT EXISTS cliente_id integer;
DO $$ BEGIN
  ALTER TABLE dm_powerbi_segmento ADD CONSTRAINT dm_powerbi_segmento_cliente_fk
    FOREIGN KEY (cliente_id) REFERENCES cliente_contratante(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS dm_powerbi_segmento_cliente_idx ON dm_powerbi_segmento(cliente_id);
-- Segmentos anteriores sem cliente ficam reservados ao administrador até serem vinculados.
COMMIT;
