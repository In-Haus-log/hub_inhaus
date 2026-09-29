import { describe, expect, it } from "vitest"
import { agruparPecs, filtrarPecs, lerDim, mcDe, totalizar, type LinhaPec } from "./agrupar"

const pec = (p: Partial<LinhaPec> & { pecCod: string }): LinhaPec => ({
  pecNome: `PEC ${p.pecCod}`, crCod: "11111", gerente: "ANA", cliente: "SUVINIL", status: "ENVIADO",
  rol: 1000, custos: 200, ...p,
})

describe("mcDe", () => {
  it("MC = ROL − custos", () => expect(mcDe(pec({ pecCod: "1" }))).toBe(800))
  it("sem lançamento não tem MC (não é zero)", () => expect(mcDe(pec({ pecCod: "1", status: "PENDENTE", rol: null, custos: null }))).toBeNull())
  it("sem custo lançado, MC = ROL", () => expect(mcDe(pec({ pecCod: "1", custos: null }))).toBe(1000))
})

describe("totalizar", () => {
  it("soma só o que foi lançado e ignora PENDENTE", () => {
    const t = totalizar([
      pec({ pecCod: "1", rol: 1000, custos: 200 }),
      pec({ pecCod: "2", rol: 3000, custos: 1000 }),
      pec({ pecCod: "3", status: "PENDENTE", rol: null, custos: null }),
    ])
    expect(t.rol).toBe(4000)
    expect(t.mc).toBe(2800)
    expect(t.margem).toBeCloseTo(0.7)
    expect(t.lancados).toBe(2)
    expect(t.total).toBe(3)
  })
  it("ROL total zero → margem nula (sem NaN)", () => {
    expect(totalizar([]).margem).toBeNull()
    expect(totalizar([pec({ pecCod: "1", rol: 0, custos: 50 })]).margem).toBeNull()
  })
})

describe("agruparPecs", () => {
  const pecs = [
    pec({ pecCod: "1", gerente: "BETO", crCod: "22222" }),
    pec({ pecCod: "2", gerente: "ANA", crCod: "11111" }),
    pec({ pecCod: "3", gerente: null, crCod: "11111" }),
    pec({ pecCod: "4", gerente: "ANA", crCod: "33333" }),
  ]
  it("por PEC: um grupo por PEC, ordenado por código", () => {
    const g = agruparPecs(pecs, "pec")
    expect(g.map((x) => x.chave)).toEqual(["1", "2", "3", "4"])
    expect(g.every((x) => x.pecs.length === 1)).toBe(true)
  })
  it("por gerente: ordena por nome e manda 'Sem informação' para o fim", () => {
    const g = agruparPecs(pecs, "gerente")
    expect(g.map((x) => x.rotulo)).toEqual(["ANA", "BETO", "Sem informação"])
    expect(g[0].pecs.map((p) => p.pecCod)).toEqual(["2", "4"])
    expect(g[0].totais.rol).toBe(2000)
  })
  it("por CR agrupa pelo código do CR", () => {
    expect(agruparPecs(pecs, "cr").map((x) => x.chave)).toEqual(["11111", "22222", "33333"])
  })
})

describe("filtrarPecs e lerDim", () => {
  const pecs = [pec({ pecCod: "092454", pecNome: "092454 - SUVINIL" }), pec({ pecCod: "555555", gerente: "JOÃO", cliente: "AMYRIS" })]
  it("busca por código, nome, CR, gerente ou cliente, sem acento e sem caixa", () => {
    expect(filtrarPecs(pecs, "suvinil")).toHaveLength(1)
    expect(filtrarPecs(pecs, "joao")[0].pecCod).toBe("555555")
    expect(filtrarPecs(pecs, "amyris")[0].pecCod).toBe("555555")
    expect(filtrarPecs(pecs, "  ")).toHaveLength(2)
  })
  it("lerDim aceita só dimensões conhecidas", () => {
    expect(lerDim("gerente")).toBe("gerente")
    expect(lerDim("conta")).toBe("pec")
    expect(lerDim(undefined)).toBe("pec")
  })
})
