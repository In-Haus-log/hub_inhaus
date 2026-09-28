import { describe, expect, it } from "vitest"
import { filtroCr } from "./sql"

describe("filtroCr (Trava 1)", () => {
  it("escopo todos não filtra", () => expect(filtroCr({ tipo: "todos" }, "p.cr_cod", 3)).toEqual({ sql: "", params: [] }))
  it("lista vazia bloqueia tudo", () => expect(filtroCr({ tipo: "lista", crs: [] }, "p.cr_cod", 3).sql).toBe(" and 1=0"))
  it("lista filtra pelo código de CR", () => {
    expect(filtroCr({ tipo: "lista", crs: ["43409"] }, "p.cr_cod", 3)).toEqual({ sql: " and p.cr_cod = any($3::text[])", params: [["43409"]] })
  })
})
