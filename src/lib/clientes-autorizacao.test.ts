import { describe, expect, it } from "vitest"
import { expandirTelasDeContratantes } from "./clientes-autorizacao"

describe("herança de telas por cliente contratante", () => {
  it("acrescenta BI e todos os sistemas do cliente sem remover concessões internas", () => {
    expect(expandirTelasDeContratantes(
      ["controle-quadro", "cliente-bi:7", "cliente-bi:42"],
      [{ id: 42, nome: "Atlas Copco", slug: "cliente-novo" }],
    )).toEqual(expect.arrayContaining([
      "controle-quadro", "cliente-bi:42", "desvios-painel", "desvios-acompanhamento", "desvios-formulario",
    ]))
    expect(expandirTelasDeContratantes(
      ["controle-quadro", "cliente-bi:7", "cliente-bi:42"],
      [{ id: 42, nome: "Atlas Copco", slug: "cliente-novo" }],
    )).not.toContain("cliente-bi:7")
  })

  it("usa slug exato e nome normalizado, sem conceder sistemas de outros clientes", () => {
    const porSlug = expandirTelasDeContratantes([], [{ id: 1, nome: "Outro Nome", slug: "atlas" }])
    const porNome = expandirTelasDeContratantes([], [{ id: 2, nome: "  ATLAS COPCO ", slug: "slug-sem-mapeamento" }])
    expect(porSlug).toContain("desvios-painel")
    expect(porNome).toContain("desvios-formulario")
    expect(porSlug).not.toContain("enjoei-turnover")
    expect(porNome).not.toContain("enjoei-absenteismo")
  })
})
