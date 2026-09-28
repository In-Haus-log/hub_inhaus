import ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"
import { gerarExcelConsolidado } from "./excel"

const linha = {
  pec: { pecCod: "092454", pecNome: "092454 (SP) - BASF", crCod: "43409", gerente: "LUCAS" },
  semanas: { 1: { status: "ENVIADO", receitaBruta: 1000, receitaLiquida: 885 }, 2: undefined },
  realizadoRol: 900, negocio: "DIRETO", gerenteRegional: "WESLEY", situacao: "ATIVO",
}

describe("gerarExcelConsolidado", () => {
  it("monta o bloco do mês no layout do Flash Report", async () => {
    const buf = await gerarExcelConsolidado("2026-09", [linha])
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const ws = wb.getWorksheet("Flash Report")!
    expect(ws.getCell("F2").value).toBe("FLASH REPORT SEMANAL")
    expect(ws.getCell("J2").value).toBe("SETEMBRO")
    expect(ws.getCell("J3").value).toBe("SEMANA 1")
    expect(ws.getCell("J5").value).toBe("ROL 1")
    expect(ws.getCell("B6").value).toBe("092454")
    expect(ws.getCell("J6").value).toBe(885)
    expect(ws.getCell("M6").value).toBeNull()              // semana 2 pendente
    expect(ws.getCell("J4").value).toBe(885)               // total da coluna
    // setembro tem 5 semanas → REALIZADO começa na coluna J + 5×3 = Y
    expect(ws.getCell("Y3").value).toBe("REALIZADO")
    expect(ws.getCell("Y6").value).toBe(900)
  })
})
