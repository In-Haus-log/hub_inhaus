import { formatarNumero, formatarPercentual, formatarVariacao } from "@/lib/format"

import type { Medida } from "./parametros"

/**
 * REGRAS DE NEGÓCIO do Projeções (em sincronia com o botão info — ProjecoesInfo):
 *  - Valor de uma célula = soma dos lançamentos daquela linha × mês. Receita é
 *    positiva e custo negativo (como no BI).
 *  - ROL = soma do grupo de Receita (receita bruta + deduções/impostos sobre faturamento).
 *  - MC = soma de TODOS os lançamentos (o resultado; linha TOTAL do BI).
 *  - % Margem = MC ÷ ROL. ROL = 0 ⇒ "—".
 *  - Diferença = Realizado − Orçado. Diferença % = Diferença ÷ |Orçado|. Com o sinal
 *    contábil, positivo é sempre favorável. Orçado = 0 ⇒ "—".
 *  - Mês sem lançamento ⇒ célula vazia (nunca zero inventado).
 * Módulo PURO.
 */

export type Par = { realizado: number; orcado: number; rolRealizado: number; rolOrcado: number }

export type LinhaAgregada = {
  chave: string
  rotulo: string
  ordem: number
  mes: string
  realizado: number
  orcado: number
  rol_realizado: number
  rol_orcado: number
}

export type No = {
  chave: string
  rotulo: string
  ordem: number
  meses: Record<string, Par>
  total: Par
}

const vazio = (): Par => ({ realizado: 0, orcado: 0, rolRealizado: 0, rolOrcado: 0 })

function acumular(par: Par, l: LinhaAgregada): void {
  par.realizado += Number(l.realizado)
  par.orcado += Number(l.orcado)
  par.rolRealizado += Number(l.rol_realizado)
  par.rolOrcado += Number(l.rol_orcado)
}

export function agruparLinhas(linhas: LinhaAgregada[]): No[] {
  const porChave = new Map<string, No>()
  for (const l of linhas) {
    let no = porChave.get(l.chave)
    if (!no) {
      no = { chave: l.chave, rotulo: l.rotulo, ordem: Number(l.ordem), meses: {}, total: vazio() }
      porChave.set(l.chave, no)
    }
    no.meses[l.mes] ??= vazio()
    acumular(no.meses[l.mes], l)
    acumular(no.total, l)
  }
  return Array.from(porChave.values()).sort(
    (a, b) => a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo, "pt-BR"),
  )
}

/** Linhas agregadas só por mês (sem chave) → nó TOTAL. */
export function totalizar(
  linhas: Omit<LinhaAgregada, "chave" | "rotulo" | "ordem">[],
): No {
  const [no] = agruparLinhas(linhas.map((l) => ({ ...l, chave: "", rotulo: "TOTAL", ordem: 0 })))
  return no ?? { chave: "", rotulo: "TOTAL", ordem: 0, meses: {}, total: vazio() }
}

export function valorMedida(
  m: Medida,
  par: { realizado: number; orcado: number } | undefined,
): number | null {
  if (!par) return null
  switch (m) {
    case "realizado":
      return par.realizado
    case "orcado":
      return par.orcado
    case "diferenca":
      return par.realizado - par.orcado
    case "diferenca_pct":
      return par.orcado === 0 ? null : ((par.realizado - par.orcado) / Math.abs(par.orcado)) * 100
  }
}

export function margemPct(mc: number, rol: number): number | null {
  return rol === 0 ? null : (mc / rol) * 100
}

export function resumo(
  par: Par | undefined,
  m: Medida,
): { rol: number | null; mc: number | null; margem: number | null } {
  if (!par) return { rol: null, mc: null, margem: null }
  const rol = valorMedida(m, { realizado: par.rolRealizado, orcado: par.rolOrcado })
  const mc = valorMedida(m, par)
  const mReal = margemPct(par.realizado, par.rolRealizado)
  const mOrc = margemPct(par.orcado, par.rolOrcado)
  let margem: number | null = null
  if (m === "realizado") margem = mReal
  else if (m === "orcado") margem = mOrc
  else if (m === "diferenca" && mReal !== null && mOrc !== null) margem = mReal - mOrc
  return { rol, mc, margem }
}

export function tom(m: Medida, v: number | null): "bom" | "ruim" | "neutro" {
  if (v === null || (m !== "diferenca" && m !== "diferenca_pct")) return "neutro"
  if (v > 0) return "bom"
  if (v < 0) return "ruim"
  return "neutro"
}

export function formatarCelula(m: Medida, v: number | null): string {
  if (v === null) return ""
  return m === "diferenca_pct" ? formatarVariacao(v, 1) : formatarNumero(v, 0)
}

export function formatarMargem(m: Medida, v: number | null): string {
  if (v === null) return "—"
  return m === "diferenca" ? formatarVariacao(v, 1).replace("%", " p.p.") : formatarPercentual(v, 1)
}
