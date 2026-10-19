import { describe, expect, it } from "vitest"
import { chaveClienteBi, idsClientesBi, podeVerClienteBi, rotaClienteBi } from "./powerbi-permissoes"

describe("permissões de relatórios Power BI por cliente", () => {
  it("monta chave e rota estáveis para um cliente", () => {
    expect(chaveClienteBi(42)).toBe("cliente-bi:42")
    expect(rotaClienteBi(42)).toBe("/dashboards/clientes/bi/42")
  })

  it("extrai ids válidos sem duplicatas e ignora chaves malformadas", () => {
    expect(idsClientesBi([
      "cliente-bi:4",
      "cliente-bi:4",
      "cliente-bi:17",
      "powerbi",
      "cliente-bi:0",
      "cliente-bi:-2",
      "cliente-bi:2x",
      "cliente-bi:9007199254740992",
    ])).toEqual([4, 17])
  })

  it("restringe acesso às chaves explícitas e concede todos os clientes ao admin", () => {
    expect(podeVerClienteBi(false, ["powerbi"], 4)).toBe(false)
    expect(podeVerClienteBi(false, ["cliente-bi:4"], 4)).toBe(true)
    expect(podeVerClienteBi(false, ["cliente-bi:4"], 5)).toBe(false)
    expect(podeVerClienteBi(true, [], 999)).toBe(true)
  })
})
