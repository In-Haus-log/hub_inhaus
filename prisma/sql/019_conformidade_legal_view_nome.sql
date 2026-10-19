-- Renomeia a view, preservando dados, definição e dependências.
DO $$
BEGIN
  IF to_regclass('public.vw_ft_conformidade_legal_vigente') IS NOT NULL THEN
    IF to_regclass('public.vw_conformidade_legal') IS NOT NULL THEN
      RAISE EXCEPTION 'As duas views existem; verificar antes de renomear.';
    END IF;
    ALTER VIEW public.vw_ft_conformidade_legal_vigente RENAME TO vw_conformidade_legal;
  END IF;
  IF to_regclass('public.vw_conformidade_legal') IS NULL THEN
    RAISE EXCEPTION 'View de conformidade legal não encontrada.';
  END IF;
END $$;
