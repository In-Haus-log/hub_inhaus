import { describe, expect, it } from "vitest"
import { crNoEscopo, filtroCr } from "./sql"

describe("filtroCr (Trava 1)", () => {
  it("escopo todos não filtra", () => expect(filtroCr({ tipo: "todos" }, "p.cr_cod", 3)).toEqual({ sql: "", params: [] }))
  it("lista vazia bloqueia tudo", () => expect(filtroCr({ tipo: "lista", crs: [] }, "p.cr_cod", 3).sql).toBe(" and 1=0"))
  it("lista filtra pelo código de CR", () => {
    expect(filtroCr({ tipo: "lista", crs: ["43409"] }, "p.cr_cod", 3)).toEqual({ sql: " and p.cr_cod = any($3::text[])", params: [["43409"]] })
  })
})

describe("crNoEscopo", () => {
  it("escopo todos aceita qualquer CR", () => expect(crNoEscopo({ tipo: "todos" }, "99999")).toBe(true))
  it("escopo em lista só aceita CR da lista", () => {
    expect(crNoEscopo({ tipo: "lista", crs: ["12345"] }, "12345")).toBe(true)
    expect(crNoEscopo({ tipo: "lista", crs: ["12345"] }, "54321")).toBe(false)
  })
  it("lista vazia não aceita nada (fail-closed)", () => expect(crNoEscopo({ tipo: "lista", crs: [] }, "12345")).toBe(false))
})
