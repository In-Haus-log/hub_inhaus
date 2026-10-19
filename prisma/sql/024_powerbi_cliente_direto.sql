BEGIN;
ALTER TABLE dm_powerbi_painel ADD COLUMN IF NOT EXISTS cliente_id integer;
UPDATE dm_powerbi_painel p SET cliente_id=s.cliente_id
FROM dm_powerbi_segmento s WHERE p.segmento_id=s.id AND p.cliente_id IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM dm_powerbi_painel WHERE cliente_id IS NULL) THEN
    RAISE EXCEPTION 'Há relatórios sem cliente. Vincule-os antes de concluir a migração.';
  END IF;
  ALTER TABLE dm_powerbi_painel ADD CONSTRAINT dm_powerbi_painel_cliente_fk
    FOREIGN KEY (cliente_id) REFERENCES cliente_contratante(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE dm_powerbi_painel ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE dm_powerbi_painel ALTER COLUMN segmento_id DROP NOT NULL;
-- Mantém o cadastro anterior para histórico, sem depender dele na aplicação.
UPDATE dm_powerbi_painel SET segmento_id=NULL WHERE segmento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dm_powerbi_painel_cliente_idx ON dm_powerbi_painel(cliente_id);
COMMIT;
