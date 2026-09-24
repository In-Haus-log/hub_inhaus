import { inhausPool } from "@/lib/db-inhaus"
import { assertLinhasNoEscopo, type EscopoDados } from "@/lib/seguranca/escopo-dados"

import { agruparLinhas, totalizar, type LinhaAgregada, type No } from "./calculos"
import {
  montarConsultaLancamentos,
  montarConsultaMeses,
  montarConsultaNivel,
  montarConsultaOpcoes,
  montarConsultaTotais,
  type Recorte,
} from "./consulta"
import { lancamentosParaCsv, type Lancamento } from "./csv"
import type { DimensaoKey } from "./dimensoes"
import type { Medida } from "./parametros"

/**
 * Leitura do Projeções no db_inhaus (ft_real_orcado + dm_conta). Server-only.
 * TRAVA 1 vem do SQL (consulta.ts). TRAVA 2 aqui: sempre que o CR vem na saída
 * (nível CR e lançamentos), confere que nenhuma linha escapou do escopo.
 */

const TAMANHO_PAGINA = 50
const LIMITE_CSV = 100_000

export async function getNivel(dim: DimensaoKey, r: Recorte, escopo: EscopoDados): Promise<No[]> {
  const { sql, params } = montarConsultaNivel(dim, r, escopo)
  const { rows } = await inhausPool.query<LinhaAgregada & { cr?: string | null }>(sql, params)
  if (dim === "cr") assertLinhasNoEscopo(rows, (l) => l.cr, escopo)
  return agruparLinhas(rows)
}

export async function getTotais(r: Recorte, escopo: EscopoDados): Promise<No> {
  const { sql, params } = montarConsultaTotais(r, escopo)
  const { rows } = await inhausPool.query(sql, params)
  return totalizar(rows)
}

export async function getMesesDisponiveis(escopo: EscopoDados): Promise<string[]> {
  const { sql, params } = montarConsultaMeses(escopo)
  const { rows } = await inhausPool.query<{ mes: string }>(sql, params)
  return rows.map((l) => l.mes)
}

export type SituacaoCarga = {
  atualizadoEm: string | null
  erro: { em: string; mensagem: string | null } | null
}

/** Última carga OK e, se houver, um erro MAIS RECENTE que ela. */
export async function getSituacaoCarga(): Promise<SituacaoCarga> {
  const { rows } = await inhausPool.query<{ concluido_em: Date; status: string; mensagem: string | null }>(
    `select concluido_em, status, mensagem from public.ft_carga_real_orcado
      where status in ('OK', 'ERRO') and concluido_em is not null
      order by concluido_em desc limit 20`,
  )
  const ok = rows.find((l) => l.status === "OK")
  const erro = rows.find((l) => l.status === "ERRO")
  const erroRecente = erro && (!ok || erro.concluido_em > ok.concluido_em) ? erro : null
  return {
    atualizadoEm: ok ? ok.concluido_em.toISOString() : null,
    erro: erroRecente ? { em: erroRecente.concluido_em.toISOString(), mensagem: erroRecente.mensagem } : null,
  }
}

export async function getLancamentos(
  r: Recorte,
  medida: Medida,
  escopo: EscopoDados,
  pagina: number,
): Promise<{ linhas: Lancamento[]; total: number; tamanhoPagina: number }> {
  const offset = (Math.max(1, pagina) - 1) * TAMANHO_PAGINA
  const { sql, params } = montarConsultaLancamentos(r, medida, escopo, { limite: TAMANHO_PAGINA, offset })
  const { rows } = await inhausPool.query<Lancamento & { total: number }>(sql, params)
  assertLinhasNoEscopo(rows, (l) => l.cr, escopo)
  return {
    linhas: rows as Lancamento[], // a coluna extra `total` é inofensiva no JSON
    total: rows[0]?.total ?? 0,
    tamanhoPagina: TAMANHO_PAGINA,
  }
}

export async function getLancamentosCsv(r: Recorte, medida: Medida, escopo: EscopoDados): Promise<string> {
  const { sql, params } = montarConsultaLancamentos(r, medida, escopo, { limite: LIMITE_CSV, offset: 0 })
  const { rows } = await inhausPool.query<Lancamento & { total: number }>(sql, params)
  assertLinhasNoEscopo(rows, (l) => l.cr, escopo)
  return lancamentosParaCsv(rows)
}

export async function getOpcoes(
  dim: DimensaoKey,
  r: Recorte,
  escopo: EscopoDados,
): Promise<{ value: string; label: string }[]> {
  const { sql, params } = montarConsultaOpcoes(dim, r, escopo)
  const { rows } = await inhausPool.query<{ valor: string; rotulo: string }>(sql, params)
  if (dim === "cr") assertLinhasNoEscopo(rows, (l) => l.valor, escopo)
  return rows.map((l) => ({ value: l.valor, label: l.rotulo || l.valor }))
}
