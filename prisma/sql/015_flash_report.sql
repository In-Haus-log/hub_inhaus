-- 015_flash_report.sql — Flash Report (projeção semanal de receita por PEC).
-- Idempotente. NUNCA aplicar via prisma db push. Uso: python scripts/aplicar_sql.py prisma/sql/015_flash_report.sql

-- 1) PECs habilitados no Flash Report ----------------------------------------------
CREATE TABLE IF NOT EXISTS dm_flash_pec (
  pec_cod      text        PRIMARY KEY,           -- 6 dígitos (casa com ft_real_orcado.pec_cod)
  pec_nome     text        NOT NULL,              -- texto completo do PEC como vem no RE x RO
  cr_cod       text        NOT NULL,              -- chave de isolamento (5 chars)
  gerente      text,                              -- nome do gerente (como no RE x RO)
  criado_por   text        NOT NULL,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  ativo        boolean     NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS dm_flash_pec_cr_idx ON dm_flash_pec (cr_cod);
COMMENT ON TABLE dm_flash_pec IS 'PECs que participam do Flash Report (projeção semanal de receita). Um por PEC.';

-- 2) Itens cobrados (parametrização) ---------------------------------------------------
CREATE TABLE IF NOT EXISTS dm_flash_item (
  id              bigserial     PRIMARY KEY,
  pec_cod         text          NOT NULL REFERENCES dm_flash_pec(pec_cod),
  cr_cod          text          NOT NULL,
  descricao       text          NOT NULL,
  tipo            text          NOT NULL CHECK (tipo IN ('PESSOAS','UNITARIO','HORA_EXTRA','DESCONTO','FIXO')),
  valor_unitario  numeric(18,4) NOT NULL CHECK (valor_unitario >= 0),
  qtd_padrao      numeric(14,2) NOT NULL DEFAULT 0 CHECK (qtd_padrao >= 0),
  conta           text          NOT NULL,        -- conta-mãe do plano do DRE (dm_conta.conta_mae)
  agrupador       text,                          -- área (A220, Loja Suvinil…)
  ordem           integer       NOT NULL DEFAULT 0,
  ativo           boolean       NOT NULL DEFAULT true,
  atualizado_em   timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dm_flash_item_pec_idx ON dm_flash_item (pec_cod);
COMMENT ON TABLE dm_flash_item IS 'Itens cobrados de cada PEC no Flash Report: tipo, valor unitário vigente, quantidade padrão e conta do DRE.';

-- 3) Projeção semanal (cabeçalho) --------------------------------------------------------
CREATE TABLE IF NOT EXISTS ft_flash_semana (
  id              bigserial     PRIMARY KEY,
  pec_cod         text          NOT NULL REFERENCES dm_flash_pec(pec_cod),
  cr_cod          text          NOT NULL,
  mes             date          NOT NULL,        -- 1º dia do mês projetado
  semana          smallint      NOT NULL CHECK (semana BETWEEN 1 AND 5),
  status          text          NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','ENVIADO','REABERTO')),
  comentario      text,
  receita_bruta   numeric(18,2) NOT NULL DEFAULT 0,
  aliquota        numeric(8,6)  NOT NULL DEFAULT 0,
  receita_liquida numeric(18,2) NOT NULL DEFAULT 0,
  enviado_por     text,
  enviado_em      timestamptz,
  atualizado_em   timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (pec_cod, mes, semana)
);
CREATE INDEX IF NOT EXISTS ft_flash_semana_mes_idx ON ft_flash_semana (mes, semana);
COMMENT ON TABLE ft_flash_semana IS 'Projeção de receita do MÊS feita pelo gestor em uma semana (1 a 5). Travada quando ENVIADO.';

-- 4) Projeção semanal (linhas) -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS ft_flash_semana_item (
  semana_id       bigint        NOT NULL REFERENCES ft_flash_semana(id) ON DELETE CASCADE,
  item_id         bigint        NOT NULL REFERENCES dm_flash_item(id),
  cr_cod          text          NOT NULL,
  valor_unitario  numeric(18,4) NOT NULL,        -- cópia do valor no momento
  quantidade      numeric(14,2) NOT NULL CHECK (quantidade >= 0),
  total           numeric(18,2) NOT NULL,
  PRIMARY KEY (semana_id, item_id)
);
COMMENT ON TABLE ft_flash_semana_item IS 'Quantidade projetada de cada item em uma semana, com o valor unitário congelado.';

-- 5) Trilha de envio/reabertura ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ft_flash_evento (
  id         bigserial   PRIMARY KEY,
  semana_id  bigint      NOT NULL REFERENCES ft_flash_semana(id) ON DELETE CASCADE,
  cr_cod     text        NOT NULL,
  acao       text        NOT NULL CHECK (acao IN ('ENVIO','REABERTURA')),
  usuario    text        NOT NULL,
  motivo     text,
  em         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE ft_flash_evento IS 'Trilha de auditoria do Flash Report: quem enviou ou reabriu cada semana, quando e por quê.';
