import { describe, expect, it } from "vitest"
import { lancamentosParaCsv } from "./csv"

describe("lancamentosParaCsv", () => {
  it("gera CSV com BOM, ponto e vírgula, vírgula decimal e aspas quando preciso", () => {
    const csv = lancamentosParaCsv([
      {
        mes: "2026-07",
        conta: "41601021",
        desc_conta: "JUROS; ATRASO",
        cr: "25415 - SP",
        pec: null,
        historico: 'NF "123"',
        lote: null,
        origem: "SC",
        realizado: -25.7,
        orcado: 0,
      },
    ])
    expect(csv.startsWith("﻿Mês;Conta;Descrição;CR;PEC;Histórico;Lote;Origem;Realizado;Orçado\r\n")).toBe(true)
    expect(csv).toContain('2026-07;41601021;"JUROS; ATRASO";25415 - SP;;"NF ""123""";;SC;-25,70;0,00')
  })

  it("neutraliza injeção de fórmula em campos de texto que começam com =, +, -, @, tab ou CR", () => {
    const csv = lancamentosParaCsv([
      {
        mes: "2026-07",
        conta: "41601021",
        desc_conta: "=SOMA(A1:A9)",
        cr: "+55 11 99999",
        pec: "-1",
        historico: "@usuario",
        lote: null,
        origem: null,
        realizado: -10,
        orcado: -1,
      },
    ])
    expect(csv).toContain("'=SOMA(A1:A9)")
    expect(csv).toContain("'+55 11 99999")
    expect(csv).toContain("'-1")
    expect(csv).toContain("'@usuario")
    // Números legítimos começando com "-" NÃO são prefixados (são formatados à parte).
    expect(csv).toContain(";-10,00;-1,00")
  })
})
