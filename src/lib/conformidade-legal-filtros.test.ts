import { describe, expect, it } from "vitest"
import { FILTROS_CONFORMIDADE_VAZIOS, filtrarConformidade, lerFiltrosConformidade, linkConformidade } from "./conformidade-legal-filtros"
import type { LinhaConformidadeLegal } from "./conformidade-legal-modelo"
const linha: LinhaConformidadeLegal = {
  mes: "2026-08", cr: "01234", crNome: "Centro A", regional: "Regional A", gerente: "Gestor A",
  supervisor: "Supervisor", funcao: "Operador", colaborador: "Pessoa", pessoaId: "pessoa-1",
  interjornada: 3, limite_hr_dia: 2, limite_hr_dia_excecao: 0, folga_semanal: 0,
  x12x36_limite_ft_mes: 0, ferias_com_ponto: 0, total: 5,
}
describe("navegação entre painel e detalhamento", () => {
  it("preserva todos os recortes e caracteres especiais na ida e na volta", () => {
    const filtros = { ...FILTROS_CONFORMIDADE_VAZIOS, mes: "2026-08", cr: "01234", gerente: "Gestor A & B", tipo: "interjornada" }
    const link = new URL(linkConformidade("/dashboards/conformidade-legal/detalhamento", filtros), "http://localhost")
    expect(lerFiltrosConformidade(Object.fromEntries(link.searchParams))).toEqual(filtros)
  })
  it("não trata parâmetros inválidos como campos ou categorias", () => {
    expect(lerFiltrosConformidade({ mes: "2026-99", cr: "1", tipo: "cpf_hash" })).toEqual(FILTROS_CONFORMIDADE_VAZIOS)
  })
  it("aplica simultaneamente recorte e tipo, sem retornar dados de outros CRs", () => {
    const filtros = { ...FILTROS_CONFORMIDADE_VAZIOS, cr: "01234", tipo: "interjornada" }
    expect(filtrarConformidade([linha, { ...linha, cr: "99999" }, { ...linha, interjornada: 0 }], filtros)).toEqual([linha])
  })
})
