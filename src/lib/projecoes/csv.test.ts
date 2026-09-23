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
})
