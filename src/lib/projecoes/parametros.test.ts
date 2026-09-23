import { describe, expect, it } from "vitest"
import {
  caminhoDe,
  escreverEstado,
  lerEstado,
  mesesEntre,
  periodoPadrao,
  rotuloMes,
  somarMeses,
} from "./parametros"

describe("lerEstado", () => {
  it("usa o padrão (Conta, Realizado, sem período) quando a URL está vazia", () => {
    expect(lerEstado(new URLSearchParams())).toEqual({
      niveis: ["conta"],
      medida: "realizado",
      periodo: null,
      filtros: {},
    })
  })
  it("lê níveis, medida, período e filtros; ignora dimensão inválida e repetida", () => {
    const sp = new URLSearchParams(
      "n=gerente&n=xpto&n=cr&n=gerente&med=diferenca&de=2026-01&ate=2026-07&f_cr=25415%20-%20X&f_regional=SP&f_inexistente=1",
    )
    expect(lerEstado(sp)).toEqual({
      niveis: ["gerente", "cr"],
      medida: "diferenca",
      periodo: { de: "2026-01", ate: "2026-07" },
      filtros: { cr: ["25415 - X"], regional: ["SP"] },
    })
  })
  it("inverte o período quando de > até e descarta mês malformado", () => {
    expect(lerEstado(new URLSearchParams("de=2026-07&ate=2026-01")).periodo).toEqual({
      de: "2026-01",
      ate: "2026-07",
    })
    expect(lerEstado(new URLSearchParams("de=2026-13&ate=2026-01")).periodo).toBeNull()
  })
  it("limita a 5 níveis", () => {
    const sp = new URLSearchParams("n=gerente&n=supervisor&n=pec&n=cr&n=cliente&n=conta")
    expect(lerEstado(sp).niveis).toHaveLength(5)
  })
})

describe("escreverEstado", () => {
  it("faz ida e volta com lerEstado", () => {
    const e = lerEstado(new URLSearchParams("n=cr&n=conta&med=orcado&de=2026-01&ate=2026-06&f_negocio=LOGISTICA"))
    expect(lerEstado(escreverEstado(e))).toEqual(e)
  })
})

describe("caminhoDe", () => {
  it("associa cada valor ao nível correspondente", () => {
    expect(caminhoDe(["gerente", "cr"], ["ANA", ""])).toEqual([
      { dim: "gerente", valor: "ANA" },
      { dim: "cr", valor: "" },
    ])
  })
  it("recusa caminho maior que os níveis", () => {
    expect(caminhoDe(["conta"], ["31101", "x"])).toBeNull()
  })
})

describe("meses", () => {
  it("soma meses atravessando o ano", () => {
    expect(somarMeses("2026-01", -1)).toBe("2025-12")
    expect(somarMeses("2025-12", 2)).toBe("2026-02")
  })
  it("lista os meses do período do mais recente para o mais antigo", () => {
    expect(mesesEntre("2025-11", "2026-02")).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"])
  })
  it("período padrão = últimos 12 meses até o mais recente com dado", () => {
    expect(periodoPadrao(["2026-06", "2026-07"])).toEqual({ de: "2026-06", ate: "2026-07" })
    expect(periodoPadrao(["2024-01", "2026-07"])).toEqual({ de: "2025-08", ate: "2026-07" })
    expect(periodoPadrao([])).toBeNull()
  })
  it("rótulo no formato do BI", () => {
    expect(rotuloMes("2026-07")).toBe("JUL 2026")
  })
})
