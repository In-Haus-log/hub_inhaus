import { describe, expect, it } from "vitest"

import { idsContratantesSelecionados, idsDeSistemasCliente, sincronizarTelasDeClientes } from "./usuarios-permissoes-ui"

describe("permissões de cliente no formulário de usuários", () => {
  it("mantém as concessões de cliente existentes ao abrir um cadastro para edição", () => {
    expect(idsContratantesSelecionados([42], ["cliente-bi:17", "cliente-bi:17", "cliente-bi:0", "projecoes-analise"]))
      .toEqual([42, 17])
  })

  it("concede e remove o Power BI e os sistemas legados junto com o cliente", () => {
    const clientes = [{ id: 17, nome: "Atlas Cópco" }, { id: 42, nome: "Cliente Novo" }]
    const portais = [{
      label: "Atlas Copco",
      telas: [{ key: "desvios-painel" }, { key: "desvios-formulario" }, { key: "em-breve", emBreve: true }],
    }]
    const atuais = ["home", "desvios-painel", "cliente-bi:17", "cliente-bi:42"]

    expect(sincronizarTelasDeClientes(atuais, [17, 42], clientes, portais)).toEqual([
      "home", "cliente-bi:17", "desvios-painel", "desvios-formulario", "cliente-bi:42",
    ])
    expect(sincronizarTelasDeClientes(atuais, [42], clientes, portais)).toEqual(["home", "cliente-bi:42"])
  })

  it("infere a seleção do cliente por sistemas legados já liberados", () => {
    expect(idsDeSistemasCliente(["desvios-painel"], [
      { id: 17, nome: "Atlas Copco" },
      { id: 42, nome: "Outro cliente" },
    ], [{ label: "Atlas Cópco", telas: [{ key: "desvios-painel" }] }])).toEqual([17])
  })

  it("preserva chaves legadas sem cliente correspondente no cadastro carregado", () => {
    expect(sincronizarTelasDeClientes(["enjoei-turnover", "controle-quadro"], [], [], [
      { label: "Enjoei", telas: [{ key: "enjoei-turnover" }] },
    ])).toEqual(["enjoei-turnover", "controle-quadro"])
  })
})
