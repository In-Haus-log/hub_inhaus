BEGIN;
ALTER TABLE dm_powerbi_painel ADD COLUMN IF NOT EXISTS icone varchar(40) NOT NULL DEFAULT 'layout-dashboard';
COMMIT;
