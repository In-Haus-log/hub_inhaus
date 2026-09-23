import { predicadoSraCr, type EscopoDados } from "@/lib/seguranca/escopo-dados"

import type { DimensaoKey } from "./dimensoes"
import type { Filtros, Medida, Periodo } from "./parametros"

/**
 * Montagem do SQL do Projeções. Módulo PURO (só gera texto + parâmetros).
 *
 * TRAVA 1 (isolamento por CR): TODA consulta passa por `montarWhere`, que injeta
 * `predicadoSraCr(escopo, "f.cr", n)`. A Trava 2 fica em dados.ts, sobre a saída.
 *
 * Valores nulos de uma dimensão viram '' (coalesce), para poderem ser filtrados
 * por igualdade ao expandir uma linha "(sem valor)".
 */

const SQL_DIM: Record<DimensaoKey, { valor: string; rotulo: string; ordem: string }> = {
  gerente: { valor: "f.gerente", rotulo: "f.gerente", ordem: "0" },
  supervisor: { valor: "f.supervisor", rotulo: "f.supervisor", ordem: "0" },
  pec: { valor: "f.pec", rotulo: "f.pec", ordem: "0" },
  cr: { valor: "f.cr", rotulo: "f.cr", ordem: "0" },
  cliente: { valor: "f.cliente", rotulo: "f.cliente", ordem: "0" },
  regional: { valor: "f.regional", rotulo: "f.regional", ordem: "0" },
  negocio: { valor: "f.negocio", rotulo: "f.negocio", ordem: "0" },
  situacao: { valor: "f.pec_situacao", rotulo: "f.pec_situacao", ordem: "0" },
  grupo: { valor: "f.grupo2", rotulo: "f.grupo2", ordem: "0" },
  conta: {
    valor: "f.conta_mae",
    rotulo: "f.conta_mae || ' - ' || coalesce(c.nome, 'CONTA NÃO MAPEADA')",
    ordem: "coalesce(c.ordem, 9999)",
  },
  subconta: { valor: "f.conta", rotulo: "f.conta || ' - ' || coalesce(f.desc_conta, '')", ordem: "0" },
}

const FROM =
  "from public.ft_real_orcado f left join public.dm_conta c on c.conta_mae = f.conta_mae"

const SOMAS =
  "sum(f.valor_realizado)::float8 as realizado, " +
  "sum(f.valor_orcado)::float8 as orcado, " +
  "sum(case when f.grupo1 like '3%' then f.valor_realizado else 0 end)::float8 as rol_realizado, " +
  "sum(case when f.grupo1 like '3%' then f.valor_orcado else 0 end)::float8 as rol_orcado"

const MES = "to_char(f.competencia, 'YYYY-MM')"

export type Recorte = {
  periodo: Periodo
  filtros: Filtros
  caminho: { dim: DimensaoKey; valor: string }[]
}

type Consulta = { sql: string; params: unknown[] }

export function montarWhere(r: Recorte, escopo: EscopoDados): Consulta {
  const params: unknown[] = [`${r.periodo.de}-01`, `${r.periodo.ate}-01`]
  let sql = "where f.competencia between $1::date and $2::date"

  for (const { dim, valor } of r.caminho) {
    params.push(valor)
    sql += ` and coalesce(${SQL_DIM[dim].valor}, '') = $${params.length}`
  }
  for (const [dim, valores] of Object.entries(r.filtros) as [DimensaoKey, string[] | undefined][]) {
    if (!valores?.length || !(dim in SQL_DIM)) continue
    params.push(valores)
    sql += ` and coalesce(${SQL_DIM[dim].valor}, '') = any($${params.length}::text[])`
  }

  const trava = predicadoSraCr(escopo, "f.cr", params.length + 1)
  return { sql: sql + trava.sql, params: [...params, ...trava.params] }
}

export function montarConsultaNivel(dim: DimensaoKey, r: Recorte, escopo: EscopoDados): Consulta {
  const d = SQL_DIM[dim]
  const w = montarWhere(r, escopo)
  const cr = dim === "cr" ? ", min(f.cr) as cr" : ""
  return {
    sql:
      `select coalesce(${d.valor}, '') as chave, coalesce(min(${d.rotulo}), '') as rotulo, ` +
      `min(${d.ordem})::int as ordem, ${MES} as mes, ${SOMAS}${cr} ${FROM} ${w.sql} group by 1, 4`,
    params: w.params,
  }
}

export function montarConsultaTotais(r: Recorte, escopo: EscopoDados): Consulta {
  const w = montarWhere(r, escopo)
  return { sql: `select ${MES} as mes, ${SOMAS} ${FROM} ${w.sql} group by 1`, params: w.params }
}

const FILTRO_MEDIDA: Record<Medida, string> = {
  realizado: " and f.valor_realizado <> 0",
  orcado: " and f.valor_orcado <> 0",
  diferenca: " and (f.valor_realizado <> 0 or f.valor_orcado <> 0)",
  diferenca_pct: " and (f.valor_realizado <> 0 or f.valor_orcado <> 0)",
}

export function montarConsultaLancamentos(
  r: Recorte,
  medida: Medida,
  escopo: EscopoDados,
  pagina: { limite: number; offset: number } | null,
): Consulta {
  const w = montarWhere(r, escopo)
  const params = [...w.params]
  let sql =
    `select ${MES} as mes, f.conta, f.desc_conta, f.cr, f.pec, f.historico, f.lote, f.origem, ` +
    `f.valor_realizado::float8 as realizado, f.valor_orcado::float8 as orcado, count(*) over()::int as total ` +
    `${FROM} ${w.sql}${FILTRO_MEDIDA[medida]} order by f.competencia desc, f.conta, f.id`
  if (pagina) {
    params.push(pagina.limite, pagina.offset)
    sql += ` limit $${params.length - 1} offset $${params.length}`
  }
  return { sql, params }
}

export function montarConsultaOpcoes(dim: DimensaoKey, r: Recorte, escopo: EscopoDados): Consulta {
  const d = SQL_DIM[dim]
  const w = montarWhere(r, escopo)
  return {
    sql:
      `select coalesce(${d.valor}, '') as valor, coalesce(min(${d.rotulo}), '') as rotulo ` +
      `${FROM} ${w.sql} group by 1 having coalesce(${d.valor}, '') <> '' ` +
      `order by min(${d.ordem}), 2 limit 2000`,
    params: w.params,
  }
}

export function montarConsultaMeses(escopo: EscopoDados): Consulta {
  const trava = predicadoSraCr(escopo, "f.cr", 1)
  return {
    sql: `select distinct ${MES} as mes from public.ft_real_orcado f where true${trava.sql} order by 1`,
    params: trava.params,
  }
}
