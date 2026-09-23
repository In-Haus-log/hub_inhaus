/**
 * Exportação dos lançamentos (detalhe de um número) em CSV que abre direto no Excel:
 * BOM UTF-8, separador ";", vírgula decimal. Módulo PURO.
 */

export type Lancamento = {
  mes: string
  conta: string
  desc_conta: string | null
  cr: string | null
  pec: string | null
  historico: string | null
  lote: string | null
  origem: string | null
  realizado: number
  orcado: number
}

const CABECALHO = ["Mês", "Conta", "Descrição", "CR", "PEC", "Histórico", "Lote", "Origem", "Realizado", "Orçado"]

function texto(v: string | null): string {
  const s = v ?? ""
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function numero(n: number): string {
  return Number(n).toFixed(2).replace(".", ",")
}

export function lancamentosParaCsv(linhas: Lancamento[]): string {
  const corpo = linhas.map((l) =>
    [
      texto(l.mes),
      texto(l.conta),
      texto(l.desc_conta),
      texto(l.cr),
      texto(l.pec),
      texto(l.historico),
      texto(l.lote),
      texto(l.origem),
      numero(l.realizado),
      numero(l.orcado),
    ].join(";"),
  )
  return "﻿" + [CABECALHO.join(";"), ...corpo].join("\r\n")
}
