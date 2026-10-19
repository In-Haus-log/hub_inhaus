-- Um período publicado representa um snapshot completo. Histórico é preservado.
CREATE OR REPLACE VIEW public.vw_conformidade_legal AS
WITH cargas_ordenadas AS (
  SELECT c.id AS carga_id, f.competencia, c.escopo_hash, c.filtros,
         c.arquivo_sha256, c.extraido_em, c.importado_em,
         row_number() OVER (
           PARTITION BY f.competencia
           ORDER BY c.importado_em DESC, c.id DESC
         ) AS ordem
  FROM public.ft_conformidade_legal_carga c
  JOIN (SELECT DISTINCT carga_id, competencia FROM public.ft_conformidade_legal) f
    ON f.carga_id = c.id
  WHERE c.status = 'COMPLETA'
)
SELECT f.*, c.escopo_hash, c.filtros AS filtros_carga, c.arquivo_sha256,
       c.extraido_em, c.importado_em
FROM public.ft_conformidade_legal f
JOIN cargas_ordenadas c
  ON c.carga_id = f.carga_id AND c.competencia = f.competencia AND c.ordem = 1;

COMMENT ON VIEW public.vw_conformidade_legal IS
  'Snapshot da última carga COMPLETA por competência, sem somar escopos de extração. Histórico mantido nas tabelas de carga e detalhe.';
