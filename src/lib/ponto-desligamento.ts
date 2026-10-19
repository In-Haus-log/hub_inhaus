/** Código estável de CR, independente da descrição ou de zeros de preenchimento. */
export function codigoCrPontoSql(coluna: string): string {
  return "lpad(btrim(split_part(" + coluna + ", ' - ', 1)), 5, '0')"
}

/**
 * Fontes compactadas uma vez por consulta. Matrícula textual + CR identificam
 * o vínculo operacional; nunca usamos nome/CPF para inferir a identidade.
 * A data efetiva no banco é dt_demissao. Datas nulas não geram exclusão.
 * As admissões posteriores permitem preservar uma recontratação comprovada.
 */
export const VINCULOS_PONTO_SQL = `
  desligamentos_base as materialized (
    select distinct btrim(matricula) as matricula,
           ${codigoCrPontoSql("cr")} as cr_codigo, dt_admissao, dt_demissao
      from public.ft_desligados
     where nullif(btrim(matricula), '') is not null
  ),
  admissoes_ponto as materialized (
    select distinct btrim(matricula) as matricula,
           ${codigoCrPontoSql("cr")} as cr_codigo, dt_admissao
      from public.ft_colaboradores_sra_diario
     where dt_admissao is not null and nullif(btrim(matricula), '') is not null
    union
    select matricula, cr_codigo, dt_admissao
      from desligamentos_base where dt_admissao is not null
  ),
  desligamentos_ponto as materialized (
    select fd.*, (
      select min(adm.dt_admissao) from admissoes_ponto adm
       where adm.matricula = fd.matricula and adm.cr_codigo = fd.cr_codigo
         and adm.dt_admissao > fd.dt_demissao
    ) as nova_admissao
    from desligamentos_base fd
  )
`

/** Exclui apenas ponto posterior à baixa, sem multiplicar linhas por vínculo. */
export function condicaoCorteDesligamentoSql(alias = "p"): string {
  return `and not exists (
    select 1 from desligamentos_ponto fd
     where fd.matricula = btrim(${alias}.matricula)
       and fd.cr_codigo = ${codigoCrPontoSql(alias + ".cr")}
       and fd.dt_demissao < ${alias}.data
       and (fd.dt_admissao is null or fd.dt_admissao <= ${alias}.data)
       and (fd.nova_admissao is null or ${alias}.data < fd.nova_admissao)
  )`
}

