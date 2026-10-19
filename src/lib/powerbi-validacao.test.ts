import { describe, expect, it } from "vitest"
import { cadastroPowerBi, linkPowerBiValido } from "./powerbi-validacao"

describe("cadastro de painéis Power BI", () => {
  const painel = { clienteId: 4, titulo: "Indicadores", url: "https://app.powerbi.com/view?r=a" }
  it("aceita apenas ícones disponíveis e mantém compatibilidade sem seleção", () => {
    expect(cadastroPowerBi.safeParse({ ...painel, icone: "wrench" }).success).toBe(true)
    expect(cadastroPowerBi.safeParse({ ...painel, icone: "icone-inexistente" }).success).toBe(false)
    expect(cadastroPowerBi.safeParse(painel).success).toBe(true)
  })

  it("aceita documentação com parágrafos e limita textos muito longos", () => {
    expect(cadastroPowerBi.parse({ ...painel, documentacao: "  Regras de cálculo\n\nFiltros por período.  " })).toMatchObject({ documentacao: "Regras de cálculo\n\nFiltros por período." })
    expect(cadastroPowerBi.safeParse({ ...painel, documentacao: "a".repeat(20001) }).success).toBe(false)
    expect(cadastroPowerBi.safeParse(painel).success).toBe(true)
  })

  it("aceita os formatos de incorporação", () => {
    for (const path of ["view?r=abc", "reportEmbed?reportId=abc", "dashboardEmbed?dashboardId=abc"]) {
      expect(linkPowerBiValido(`https://app.powerbi.com/${path}`)).toBe(true)
    }
  })

  it("rejeita protocolos, domínios e caminhos arbitrários", () => {
    for (const url of ["javascript:alert(1)", "http://app.powerbi.com/view?r=a", "https://app.powerbi.com.evil.com/view?r=a", "https://evil.com/view?r=a", "https://user@app.powerbi.com/view?r=a", "https://app.powerbi.com/groups/me", "https://app.powerbi.com/view"]) {
      expect(linkPowerBiValido(url)).toBe(false)
    }
  })

  it("exige título, cliente positivo e URL válida; rejeita os campos antigos", () => {
    expect(cadastroPowerBi.safeParse({ ...painel, titulo: "  " }).success).toBe(false)
    expect(cadastroPowerBi.safeParse({ ...painel, clienteId: 0 }).success).toBe(false)
    expect(cadastroPowerBi.safeParse({ ...painel, clienteId: -1 }).success).toBe(false)
    expect(cadastroPowerBi.safeParse({ ...painel, url: "https://example.com" }).success).toBe(false)
    expect(cadastroPowerBi.safeParse({ ...painel, tipo: "painel", segmentoId: 2 }).success).toBe(false)
    expect(cadastroPowerBi.parse({ ...painel, titulo: "  Indicadores  " })).toEqual(painel)
  })
})
