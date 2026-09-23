import { describe, expect, it } from "vitest"
import {
  agruparLinhas,
  formatarCelula,
  formatarMargem,
  margemPct,
  resumo,
  tom,
  totalizar,
  valorMedida,
  type LinhaAgregada,
} from "./calculos"

const l = (p: Partial<LinhaAgregada>): LinhaAgregada => ({
  chave: "x",
  rotulo: "X",
  ordem: 0,
  mes: "2026-07",
  realizado: 0,
  orcado: 0,
  rol_realizado: 0,
  rol_orcado: 0,
  ...p,
})

describe("agruparLinhas", () => {
  it("junta os meses de cada chave, soma o total e ordena por ordem e rótulo", () => {
    const nos = agruparLinhas([
      l({ chave: "41101", rotulo: "41101 - PESSOAL", ordem: 3, mes: "2026-06", realizado: -3835182 }),
      l({ chave: "31101", rotulo: "31101 - RECEITAS", ordem: 1, mes: "2026-07", realizado: 14955162, rol_realizado: 14955162 }),
      l({ chave: "41101", rotulo: "41101 - PESSOAL", ordem: 3, mes: "2026-07", realizado: -3934842 }),
    ])
    expect(nos.map((n) => n.chave)).toEqual(["31101", "41101"])
    expect(nos[1].meses["2026-06"].realizado).toBe(-3835182)
    expect(nos[1].total.realizado).toBe(-7770024)
  })
  it("converte números que chegam como texto", () => {
    const [no] = agruparLinhas([l({ realizado: "10.5" as unknown as number })])
    expect(no.total.realizado).toBe(10.5)
  })
})

describe("totalizar", () => {
  it("devolve um nó TOTAL mesmo sem linhas", () => {
    expect(totalizar([]).total.realizado).toBe(0)
  })
})

describe("medidas", () => {
  const par = { realizado: -90, orcado: -100, rolRealizado: 0, rolOrcado: 0 }
  it("realizado, orçado e diferença", () => {
    expect(valorMedida("realizado", par)).toBe(-90)
    expect(valorMedida("orcado", par)).toBe(-100)
    expect(valorMedida("diferenca", par)).toBe(10)
  })
  it("diferença % sobre o módulo do orçado (custo menor = positivo)", () => {
    expect(valorMedida("diferenca_pct", par)).toBeCloseTo(10)
    expect(valorMedida("diferenca_pct", { ...par, realizado: 110, orcado: 100 })).toBeCloseTo(10)
  })
  it("sem orçado a diferença % é vazia; mês sem dado é vazio", () => {
    expect(valorMedida("diferenca_pct", { ...par, orcado: 0 })).toBeNull()
    expect(valorMedida("realizado", undefined)).toBeNull()
  })
})

describe("ROL, MC e % Margem", () => {
  it("margem = MC ÷ ROL e nunca divide por zero", () => {
    expect(margemPct(1763243, 13308570)).toBeCloseTo(13.25, 1)
    expect(margemPct(10, 0)).toBeNull()
  })
  it("resumo do realizado (exemplo jul/2026)", () => {
    const r = resumo({ realizado: 1763243, orcado: 1421697, rolRealizado: 13308570, rolOrcado: 12000000 }, "realizado")
    expect(r.rol).toBe(13308570)
    expect(r.mc).toBe(1763243)
    expect(r.margem).toBeCloseTo(13.25, 1)
  })
  it("na diferença a margem vira diferença de pontos percentuais", () => {
    const r = resumo({ realizado: 20, orcado: 10, rolRealizado: 100, rolOrcado: 100 }, "diferenca")
    expect(r.margem).toBeCloseTo(10)
  })
})

describe("tom e formatação", () => {
  it("só diferenças ganham cor", () => {
    expect(tom("diferenca", 5)).toBe("bom")
    expect(tom("diferenca_pct", -1)).toBe("ruim")
    expect(tom("realizado", -1)).toBe("neutro")
    expect(tom("diferenca", null)).toBe("neutro")
  })
  it("formata como o BI (sem casas) e percentuais com 1 casa", () => {
    expect(formatarCelula("realizado", 1763243.4)).toBe("1.763.243")
    expect(formatarCelula("diferenca_pct", 6.34)).toBe("+6,3%")
    expect(formatarCelula("realizado", null)).toBe("")
    expect(formatarMargem("realizado", 13.25)).toBe("13,3%")
    expect(formatarMargem("diferenca", -1.2)).toBe("−1,2 p.p.")
    expect(formatarMargem("realizado", null)).toBe("—")
  })
})
