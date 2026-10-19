-- 018_conformidade_legal.sql — cargas e fatos detalhados de conformidade legal.
-- Aditivo e idempotente. Aplicação manual; NUNCA usar prisma db push/migrate.
-- Linhas agregadas (Total/subtotais) são rejeitadas pelas constraints de dimensão.

CREATE TABLE IF NOT EXISTS public.ft_conformidade_legal_carga (
  id                bigserial PRIMARY KEY,
  arquivo_nome      text NOT NULL,
  arquivo_sha256    varchar(64) NOT NULL CHECK (arquivo_sha256 ~ '^[0-9a-fA-F]{64}$'),
  escopo_hash       varchar(64) NOT NULL CHECK (escopo_hash ~ '^[0-9a-fA-F]{64}$'),
  filtros           jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filtros) = 'object'),
  extraido_em       timestamptz,
  importado_em      timestamptz NOT NULL DEFAULT now(),
  status            text NOT NULL DEFAULT 'PROCESSANDO'
                    CHECK (status IN ('PROCESSANDO', 'COMPLETA', 'FALHA')),
  quantidade        integer CHECK (quantidade IS NULL OR quantidade >= 0),
  UNIQUE (arquivo_sha256, escopo_hash)
);

COMMENT ON TABLE public.ft_conformidade_legal_carga IS
  'Metadados e estado de cada arquivo extraído. A view de consumo considera somente cargas COMPLETAS.';
COMMENT ON COLUMN public.ft_conformidade_legal_carga.escopo_hash IS
  'SHA-256 hexadecimal dos filtros normalizados; identifica o escopo para comparação entre cargas.';
COMMENT ON COLUMN public.ft_conformidade_legal_carga.extraido_em IS
  'Instante declarado pela origem, NULL quando não informado.';
COMMENT ON COLUMN public.ft_conformidade_legal_carga.quantidade IS
  'Quantidade de linhas detalhadas gravadas na carga (sem totais e subtotais).';

CREATE TABLE IF NOT EXISTS public.ft_conformidade_legal (
  id                         bigserial PRIMARY KEY,
  carga_id                   bigint NOT NULL REFERENCES public.ft_conformidade_legal_carga(id) ON DELETE CASCADE,
  linha_origem               integer NOT NULL CHECK (linha_origem > 0),
  competencia                date NOT NULL CHECK (extract(day FROM competencia) = 1),
  gerente_regional           text,
  gerente                    text,
  cr_cod                     varchar(5) NOT NULL CHECK (length(cr_cod) = 5 AND btrim(cr_cod) <> ''),
  cr_nome                    text,
  supervisor                 text,
  funcao                     text,
  colaborador_nome           text,
  cpf_hash                   varchar(64) CHECK (cpf_hash IS NULL OR cpf_hash ~ '^[0-9a-fA-F]{64}$'),
  interjornada               integer CHECK (interjornada IS NULL OR interjornada >= 0),
  limite_hr_dia               integer CHECK (limite_hr_dia IS NULL OR limite_hr_dia >= 0),
  limite_hr_dia_excecao       integer CHECK (limite_hr_dia_excecao IS NULL OR limite_hr_dia_excecao >= 0),
  folga_semanal               integer CHECK (folga_semanal IS NULL OR folga_semanal >= 0),
  x12x36_limite_ft_mes        integer CHECK (x12x36_limite_ft_mes IS NULL OR x12x36_limite_ft_mes >= 0),
  ferias_com_ponto            integer CHECK (ferias_com_ponto IS NULL OR ferias_com_ponto >= 0),
  total_ocorrencias           integer CHECK (total_ocorrencias IS NULL OR total_ocorrencias >= 0),
  total_processos             integer CHECK (total_processos IS NULL OR total_processos >= 0),
  processos_encerrados        integer CHECK (processos_encerrados IS NULL OR processos_encerrados >= 0),
  ticket_medio_encerrado      numeric(18,4),
  UNIQUE (carga_id, linha_origem),
  CONSTRAINT ft_conformidade_legal_sem_total CHECK (
    upper(btrim(coalesce(gerente_regional, ''))) <> 'TOTAL' AND
    upper(btrim(coalesce(gerente, ''))) <> 'TOTAL' AND
    upper(btrim(coalesce(cr_cod, ''))) <> 'TOTAL' AND
    upper(btrim(coalesce(cr_nome, ''))) <> 'TOTAL' AND
    upper(btrim(coalesce(supervisor, ''))) <> 'TOTAL' AND
    upper(btrim(coalesce(funcao, ''))) <> 'TOTAL' AND
    upper(btrim(coalesce(colaborador_nome, ''))) <> 'TOTAL'
  )
);

COMMENT ON TABLE public.ft_conformidade_legal IS
  'Fato detalhado por competência, hierarquia/CR e colaborador. Armazena somente registros de detalhe, sem totais ou subtotais.';
COMMENT ON COLUMN public.ft_conformidade_legal.cpf_hash IS
  'HMAC-SHA-256 do CPF usando o segredo institucional; CPF em claro nunca deve ser persistido nesta base.';
COMMENT ON COLUMN public.ft_conformidade_legal.ticket_medio_encerrado IS
  'Valor original do drill, inclusive sinal negativo; não deve ser somado automaticamente.';

CREATE INDEX IF NOT EXISTS ft_conformidade_legal_competencia_idx
  ON public.ft_conformidade_legal (competencia);
CREATE INDEX IF NOT EXISTS ft_conformidade_legal_cr_idx
  ON public.ft_conformidade_legal (cr_cod, competencia);
CREATE INDEX IF NOT EXISTS ft_conformidade_legal_cpf_hash_idx
  ON public.ft_conformidade_legal (cpf_hash) WHERE cpf_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS ft_conformidade_legal_carga_escopo_idx
  ON public.ft_conformidade_legal_carga (escopo_hash, status, importado_em DESC, id DESC);

CREATE OR REPLACE VIEW public.vw_conformidade_legal AS
WITH cargas_ordenadas AS (
  SELECT c.id AS carga_id,
         f.competencia,
         c.escopo_hash,
         c.filtros,
         c.arquivo_sha256,
         c.extraido_em,
         c.importado_em,
         row_number() OVER (
           PARTITION BY f.competencia, c.escopo_hash
           ORDER BY c.importado_em DESC, c.id DESC
         ) AS ordem
  FROM public.ft_conformidade_legal_carga c
  JOIN (SELECT DISTINCT carga_id, competencia FROM public.ft_conformidade_legal) f
    ON f.carga_id = c.id
  WHERE c.status = 'COMPLETA'
)
SELECT f.*,
       c.escopo_hash,
       c.filtros AS filtros_carga,
       c.arquivo_sha256,
       c.extraido_em,
       c.importado_em
FROM public.ft_conformidade_legal f
JOIN cargas_ordenadas c ON c.carga_id = f.carga_id AND c.competencia = f.competencia AND c.ordem = 1;

COMMENT ON VIEW public.vw_conformidade_legal IS
  'Linhas da última carga COMPLETA por competência e escopo_hash. Valores de processos e ticket permanecem no nível original e não são agregados.';

