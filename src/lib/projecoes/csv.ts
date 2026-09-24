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

// Campos de texto que começam com =, +, -, @, tab ou retorno de carro viram fórmula
// ao abrir no Excel — prefixa um ' para neutralizar (só em texto; números legítimos
// começam com "-" e são formatados à parte, em `numero()`).
function texto(v: string | null): string {
  let s = v ?? ""
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
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
