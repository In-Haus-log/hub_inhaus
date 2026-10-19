-- Extensão aditiva: não remove itens nem altera medições históricas.
-- Executar uma vez no db_inhaus; seguro repetir.
BEGIN;
ALTER TABLE public.dm_flash_item
  ADD COLUMN IF NOT EXISTS parametros jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
