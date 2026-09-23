-- 014_projecoes.sql — Módulo Projeções (etapa 1): base histórica Realizado × Orçado.
-- Idempotente. Aplicar com: python scripts/aplicar_sql.py prisma/sql/014_projecoes.sql
-- NUNCA via prisma db push/migrate (ver CLAUDE.md).

-- 1) Log das cargas --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ft_carga_real_orcado (
  id              bigserial PRIMARY KEY,
  iniciado_em     timestamptz   NOT NULL DEFAULT now(),
  concluido_em    timestamptz,
  origem          text          NOT NULL,
  competencias    date[]        NOT NULL DEFAULT '{}',
  linhas          integer       NOT NULL DEFAULT 0,
  total_realizado numeric(18,2) NOT NULL DEFAULT 0,
  total_orcado    numeric(18,2) NOT NULL DEFAULT 0,
  status          text          NOT NULL DEFAULT 'EM_ANDAMENTO',
  mensagem        text
);

COMMENT ON TABLE ft_carga_real_orcado IS
  'Registro de cada execução de carga do RE x RO (RPA ou script): quando rodou, quais meses substituiu, quantas linhas e os totais gravados. Usado para mostrar a data de atualização na tela e auditar cargas.';

-- 2) Plano de contas gerencial do DRE ----------------------------------------------
CREATE TABLE IF NOT EXISTS dm_conta (
  conta_mae text    PRIMARY KEY,
  nome      text    NOT NULL,
  grupo2    text,
  ordem     integer NOT NULL,
  ativo     boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE dm_conta IS
  'Plano de contas gerencial do DRE do módulo Projeções: uma linha por conta-mãe (5 dígitos), com nome, grupo e ordem de exibição. Traduz as contas detalhadas dos lançamentos nas linhas do DRE.';

-- 3) Lançamentos Realizado × Orçado ---------------------------------------------------
CREATE TABLE IF NOT EXISTS ft_real_orcado (
  id              bigserial PRIMARY KEY,
  competencia     date          NOT NULL,
  valor_realizado numeric(18,2) NOT NULL DEFAULT 0,
  valor_orcado    numeric(18,2) NOT NULL DEFAULT 0,
  origem          text,
  conta           text          NOT NULL,
  desc_conta      text,
  grupo1          text,
  grupo2          text,
  cr              text,
  centro_custo    text,
  pec             text,
  cliente         text,
  seg_cliente     text,
  tipo_cliente    text,
  regional        text,
  negocio         text,
  solucao         text,
  grupo_ind       text,
  gerente         text,
  supervisor      text,
  gerente_geral   text,
  dir_reg         text,
  dir_exe         text,
  empresa         text,
  emp_ctb         text,
  nome_emp_ctb    text,
  reg_emp_ctb     text,
  reg_cr          text,
  historico       text,
  lote            text,
  conq_perda      text,
  carga_id        bigint REFERENCES ft_carga_real_orcado(id),
  -- Derivadas: o RPA NÃO grava; o banco calcula.
  cr_cod text GENERATED ALWAYS AS (
    CASE
      WHEN cr IS NULL OR btrim(split_part(btrim(cr), ' - ', 1)) = '' THEN NULL
      WHEN length(split_part(btrim(cr), ' - ', 1)) < 5 THEN lpad(split_part(btrim(cr), ' - ', 1), 5, '0')
      ELSE split_part(btrim(cr), ' - ', 1)
    END
  ) STORED,
  pec_cod      text GENERATED ALWAYS AS (left(pec, 6)) STORED,
  pec_situacao text GENERATED ALWAYS AS (nullif(btrim(substring(pec from '.*/ (.*)$')), '')) STORED,
  conta_mae    text GENERATED ALWAYS AS (left(conta, 5)) STORED
);

COMMENT ON TABLE ft_real_orcado IS
  'Lançamentos contábeis de Realizado e Orçado por CR e conta, no mesmo grão do relatório RE x RO do sistema da GPS. Alimentada por RPA com recarga por mês de competência (os meses presentes no arquivo são substituídos integralmente). Base histórica do módulo Projeções.';

CREATE INDEX IF NOT EXISTS ft_real_orcado_competencia_idx ON ft_real_orcado (competencia);
CREATE INDEX IF NOT EXISTS ft_real_orcado_cr_comp_idx     ON ft_real_orcado (cr_cod, competencia);
CREATE INDEX IF NOT EXISTS ft_real_orcado_conta_comp_idx  ON ft_real_orcado (conta_mae, competencia);
CREATE INDEX IF NOT EXISTS ft_real_orcado_pec_idx         ON ft_real_orcado (pec_cod);

-- 4) Cadastro inicial: as 30 linhas do BI 1.2.05, na ordem do BI -----------------------
INSERT INTO dm_conta (conta_mae, nome, grupo2, ordem) VALUES
  ('31101', 'RECEITAS DE VENDAS E SERVICOS',                       '311 - RECEITA BRUTA',                          1),
  ('31201', 'IMPOSTOS S/FATURAMENTO',                              '312 - DEDUCOES DE RECEITA',                    2),
  ('41101', 'PESSOAL',                                             '411 - CUSTOS COM PESSOAL',                     3),
  ('41103', 'PARTICIPACAO NOS RESULTADOS',                         '411 - CUSTOS COM PESSOAL',                     4),
  ('41104', 'ENCARGOS SOCIAIS E TRABALHISTAS',                     '411 - CUSTOS COM PESSOAL',                     5),
  ('41105', 'PROVISOES TRABALHISTAS',                              '411 - CUSTOS COM PESSOAL',                     6),
  ('41106', 'BENEFICIOS',                                          '411 - CUSTOS COM PESSOAL',                     7),
  ('41201', 'MEDICINA E SEGURANCA TRABALHO',                       '412 - MEDICINA E SEGURANCA TRABALHO',          8),
  ('41301', 'TRANSPORTES',                                         '413 - DESPESAS COM TRANSPORTE',                9),
  ('41401', 'SERVICOS CONTRATADOS - PJ',                           '414 - SERVICOS E LOCACOES',                   10),
  ('41403', 'LOCACOES E LEASING',                                  '414 - SERVICOS E LOCACOES',                   11),
  ('41501', 'MATERIAIS DE CONSERVACAO E APOIO',                    '415 - MATERIAIS',                             12),
  ('41502', 'MATERIAL DE CONSUMO GERAL',                           '415 - MATERIAIS',                             13),
  ('41503', 'INSUMOS / CUSTO DE REVENDA',                          '415 - MATERIAIS',                             14),
  ('41504', 'INSUMOS/ PERECIVEIS NAO PERECIVEIS',                  '415 - MATERIAIS',                             15),
  ('41601', 'DESPESAS GERAIS',                                     '416 - DESPESAS GERAIS',                       16),
  ('41602', 'COMUNICACOES',                                        '416 - DESPESAS GERAIS',                       17),
  ('41603', 'VIAGENS E ESTADIAS',                                  '416 - DESPESAS GERAIS',                       18),
  ('41604', 'DESPESAS COM EXECUCOES JUDICIAIS TRABALHISTAS',       '416 - DESPESAS GERAIS',                       19),
  ('41606', 'PROVISOES CONTRATUAIS (PCO)',                         '416 - DESPESAS GERAIS',                       20),
  ('41607', 'DESPESAS COM EXECUCOES JUDICIAIS TRAB COLET PUB ACP', '416 - DESPESAS GERAIS',                       21),
  ('41608', 'DESPESAS COM EXECUCOES JUDICIAIS NAO TRABALHISTAS',   '416 - DESPESAS GERAIS',                       22),
  ('41701', 'IMPOSTOS, ADC., EMOLUMENTOS E LICENCAS',              '417 - IMPOSTOS, ADC., EMOLUMENTOS E LICENCAS', 23),
  ('41801', 'DEPRECIACOES/AMORTIZACOES',                           '418 - DEPRECIACOES/AMORTIZACOES',             24),
  ('41901', 'RECEITAS FINANCEIRAS',                                '419 - RESULTADO FINANCEIRO LIQUIDO',          25),
  ('41902', 'DESPESAS FINANCEIRAS',                                '419 - RESULTADO FINANCEIRO LIQUIDO',          26),
  ('42101', 'PERDAS COM CLIENTES',                                 '421 - PERDAS COM CLIENTES',                   27),
  ('43101', 'RECEITA NAO OPERACIONAL',                             '431 - RESULTADO NAO OPERACIONAL',             28),
  ('43201', 'VENDA DE ATIVO IMOBILIZADO',                          '432 - VENDA DE ATIVO IMOBILIZADO',            29),
  ('44101', 'DESPESAS NAO DEDUTIVEIS',                             '441 - DESPESAS NAO DEDUTIVEIS',               30)
ON CONFLICT (conta_mae) DO NOTHING;
