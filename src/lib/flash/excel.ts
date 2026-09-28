import ExcelJS from "exceljs"

import type { LinhaConsolidado } from "./dados"
import { semanasDoMes } from "./semanas"

/** Excel do consolidado no layout da guia "Flash Report" enviada ao corporativo. Fase 1: MC e % vazios. */
const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"]
const COL_INICIO = 10 // J
const FORMATO = "#,##0.00"

export async function gerarExcelConsolidado(mes: string, linhas: LinhaConsolidado[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Flash Report")
  const semanas = semanasDoMes(mes)
  ws.getCell("F2").value = "FLASH REPORT SEMANAL"
  ws.getCell(2, COL_INICIO).value = MESES[Number(mes.slice(5, 7)) - 1]

  const cab = ["CONCATENAR", "PEC.", "NEG.", "CT", "Tipo", "GERENTE REGIONAL", "GERENTE", "PEC"]
  cab.forEach((t, i) => (ws.getCell(5, i + 1).value = t))

  const blocos = [...semanas.map((n) => ({ titulo: `SEMANA ${n}`, suf: ` ${n}`, n })), { titulo: "REALIZADO", suf: "", n: 0 }]
  blocos.forEach((b, k) => {
    const c = COL_INICIO + k * 3
    ws.getCell(3, c).value = b.titulo
    ws.getCell(5, c).value = `ROL${b.suf}`
    ws.getCell(5, c + 1).value = `MC${b.suf}`
    ws.getCell(5, c + 2).value = `%${b.suf}`
  })

  linhas.forEach((l, i) => {
    const r = 6 + i
    const fixos = [`${l.pec.pecCod}${l.pec.gerente ?? ""}`, l.pec.pecCod, l.negocio, l.situacao, null, l.gerenteRegional, l.pec.gerente, l.pec.pecNome]
    fixos.forEach((v, j) => (ws.getCell(r, j + 1).value = v ?? null))
    blocos.forEach((b, k) => {
      const v = b.n === 0 ? l.realizadoRol : l.semanas[b.n]?.receitaLiquida
      const cel = ws.getCell(r, COL_INICIO + k * 3)
      cel.value = v ?? null
      cel.numFmt = FORMATO
    })
  })

  blocos.forEach((_, k) => {
    const c = COL_INICIO + k * 3
    let soma = 0
    for (let r = 6; r < 6 + linhas.length; r++) soma += Number(ws.getCell(r, c).value ?? 0)
    const cel = ws.getCell(4, c); cel.value = Math.round(soma * 100) / 100; cel.numFmt = FORMATO
  })
  ;[2, 3, 4, 5].forEach((r) => (ws.getRow(r).font = { bold: true }))
  return Buffer.from(await wb.xlsx.writeBuffer())
}
