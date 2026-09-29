-- 016_projecoes_parametrizacao.sql — Parametrização do PEC: natureza (receita/custo) e CR por item.
-- Idempotente. NUNCA aplicar via prisma db push. Uso: python scripts/aplicar_sql.py prisma/sql/016_projecoes_parametrizacao.sql

-- 1) Natureza do item (itens atuais continuam RECEITA) ------------------------------------
ALTER TABLE dm_flash_item ADD COLUMN IF NOT EXISTS natureza text NOT NULL DEFAULT 'RECEITA';
DO $$ BEGIN
  ALTER TABLE dm_flash_item
    ADD CONSTRAINT dm_flash_item_natureza_check CHECK (natureza IN ('RECEITA','CUSTO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Novos tipos de custo (TAXA, VARIAVEL) ------------------------------------------------
ALTER TABLE dm_flash_item DROP CONSTRAINT IF EXISTS dm_flash_item_tipo_check;
ALTER TABLE dm_flash_item
  ADD CONSTRAINT dm_flash_item_tipo_check
  CHECK (tipo IN ('PESSOAS','UNITARIO','HORA_EXTRA','DESCONTO','FIXO','TAXA','VARIAVEL'));

-- 3) Conta deixa de ser exigida (vínculo com conta saiu do escopo) ------------------------
ALTER TABLE dm_flash_item ALTER COLUMN conta DROP NOT NULL;

-- 4) Natureza congelada na semana (o histórico não muda se o cadastro mudar) -------------
ALTER TABLE ft_flash_semana_item ADD COLUMN IF NOT EXISTS natureza text NOT NULL DEFAULT 'RECEITA';
DO $$ BEGIN
  ALTER TABLE ft_flash_semana_item
    ADD CONSTRAINT ft_flash_semana_item_natureza_check CHECK (natureza IN ('RECEITA','CUSTO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Somas por CR na visão de Projeções.
CREATE INDEX IF NOT EXISTS ft_flash_semana_item_cr_idx ON ft_flash_semana_item (cr_cod);

COMMENT ON COLUMN dm_flash_item.natureza IS 'RECEITA (entra no ROL) ou CUSTO (sai do MC). O CR do item fica em cr_cod.';
COMMENT ON COLUMN ft_flash_semana_item.natureza IS 'Natureza do item congelada no momento do lançamento da semana.';
