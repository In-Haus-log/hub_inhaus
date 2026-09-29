import { describe, expect, it } from "vitest"
import { itemSchema, periodoSchema, rascunhoSchema, reaberturaSchema, validarQuantidades } from "./validacao"

describe("validação", () => {
  it("item exige descrição, tipo válido, valor ≥ 0", () => {
    expect(itemSchema.safeParse({ descricao: "Separador", tipo: "PESSOAS", valorUnitario: 6978.4, qtdPadrao: 15 }).success).toBe(true)
    expect(itemSchema.safeParse({ descricao: "", tipo: "PESSOAS", valorUnitario: 1, qtdPadrao: 1 }).success).toBe(false)
    expect(itemSchema.safeParse({ descricao: "x", tipo: "OUTRO", valorUnitario: 1, qtdPadrao: 1 }).success).toBe(false)
    expect(itemSchema.safeParse({ descricao: "x", tipo: "FIXO", valorUnitario: -1, qtdPadrao: 1 }).success).toBe(false)
  })
  it("rascunho rejeita quantidade negativa ou não numérica", () => {
    expect(rascunhoSchema.safeParse({ linhas: [{ itemId: 1, quantidade: 3 }] }).success).toBe(true)
    expect(rascunhoSchema.safeParse({ linhas: [{ itemId: 1, quantidade: -1 }] }).success).toBe(false)
    expect(rascunhoSchema.safeParse({ linhas: [{ itemId: 1, quantidade: "abc" }] }).success).toBe(false)
  })
  it("pessoas não aceita fração; hora extra aceita", () => {
    const tipos = new Map([[1, "PESSOAS" as const], [2, "HORA_EXTRA" as const]])
    expect(validarQuantidades([{ itemId: 1, quantidade: 2.5 }], tipos)).toMatch(/inteir/)
    expect(validarQuantidades([{ itemId: 2, quantidade: 12.5 }], tipos)).toBeNull()
    expect(validarQuantidades([{ itemId: 9, quantidade: 1 }], tipos)).toMatch(/não pertence/)
  })
  it("reabertura exige motivo; período valida mês e semana", () => {
    expect(reaberturaSchema.safeParse({ motivo: "" }).success).toBe(false)
    expect(periodoSchema.safeParse({ mes: "2026-09", semana: "2" }).data).toEqual({ mes: "2026-09", semana: 2 })
    expect(periodoSchema.safeParse({ mes: "2026-9", semana: 6 }).success).toBe(false)
  })
  it("semana precisa existir no mês (fev/2027 tem 4 semanas)", () => {
    expect(periodoSchema.safeParse({ mes: "2027-02", semana: 5 }).success).toBe(false)
    expect(periodoSchema.safeParse({ mes: "2026-09", semana: 5 }).success).toBe(true)
  })
})

describe("itemSchema — natureza e CR", () => {
  const base = { descricao: "Hora extra 50%", tipo: "HORA_EXTRA", valorUnitario: 40, qtdPadrao: 0 }
  it("item antigo (sem natureza e sem conta) vira RECEITA e continua válido", () => {
    const r = itemSchema.parse({ ...base, tipo: "PESSOAS" })
    expect(r.natureza).toBe("RECEITA")
    expect(r.crCod).toBeNull()
  })
  it("aceita custo de hora extra, taxa e variável", () => {
    for (const tipo of ["HORA_EXTRA", "TAXA", "VARIAVEL"])
      expect(itemSchema.safeParse({ ...base, natureza: "CUSTO", tipo }).success).toBe(true)
  })
  it("rejeita DESCONTO em custo e TAXA em receita", () => {
    expect(itemSchema.safeParse({ ...base, natureza: "CUSTO", tipo: "DESCONTO" }).success).toBe(false)
    expect(itemSchema.safeParse({ ...base, natureza: "RECEITA", tipo: "TAXA" }).success).toBe(false)
  })
  it("CR do item: 5 caracteres, vira maiúsculo; vazio vira null", () => {
    expect(itemSchema.parse({ ...base, crCod: "c95dr" }).crCod).toBe("C95DR")
    expect(itemSchema.parse({ ...base, crCod: "" }).crCod).toBeNull()
    expect(itemSchema.safeParse({ ...base, crCod: "123" }).success).toBe(false)
  })
})
