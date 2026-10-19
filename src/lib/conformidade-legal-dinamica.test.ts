import { describe, expect, it } from "vitest"
import type { LinhaConformidadeLegal } from "@/lib/conformidade-legal-modelo"
import { gerarCsvSeguro, montarPivotConformidade } from "./conformidade-legal-dinamica"

const linha = (extra: Partial<LinhaConformidadeLegal> = {}): LinhaConformidadeLegal => ({
  mes: "2026-08", cr: "24238", crNome: "24238 - CR A", regional: "Norte", gerente: "Ana", supervisor: "Bia", funcao: "Auxiliar",
  colaborador: "Pessoa A", pessoaId: "pessoa-1", interjornada: 2, limite_hr_dia: 0, limite_hr_dia_excecao: 0,
  folga_semanal: 0, x12x36_limite_ft_mes: 0, ferias_com_ponto: 0, total: 2, ...extra,
})

describe("tabela dinâmica de conformidade", () => {
  it("soma as categorias no geral e separa por tipo sem misturar valores", () => {
    const linhas = [linha({ interjornada: 2, ferias_com_ponto: 1 }), linha({ mes: "2026-09", pessoaId: "pessoa-2", interjornada: 3, total: 3 })]
    const geral = montarPivotConformidade(linhas, { linha: "regional", coluna: "mes", metrica: "ocorrencias" })
    expect(geral.colunas.map((coluna) => coluna.chave)).toEqual(["2026-08", "2026-09"])
    expect(geral.linhas[0]?.valores).toEqual([3, 3])
    expect(geral.total).toBe(6)

    const porTipo = montarPivotConformidade(linhas, { linha: "regional", coluna: "tipo", metrica: "ocorrencias" })
    expect(porTipo.linhas[0]?.valores).toEqual([5, 0, 0, 0, 0, 1])
    expect(porTipo.totaisColuna).toEqual([5, 0, 0, 0, 0, 1])
  })

  it("recalcula pessoas distintas em cada célula e no total, sem somar duplicidades", () => {
    const linhas = [
      linha({ pessoaId: "pessoa-1", regional: "Norte", mes: "2026-08" }),
      linha({ pessoaId: "pessoa-1", regional: "Norte", mes: "2026-09" }),
      linha({ pessoaId: "pessoa-2", regional: "Sul", mes: "2026-08" }),
    ]
    const resultado = montarPivotConformidade(linhas, { linha: "regional", coluna: "mes", metrica: "pessoas" })
    expect(resultado.linhas.find((item) => item.rotulos[0] === "Norte")?.valores).toEqual([1, 1])
    expect(resultado.linhas.find((item) => item.rotulos[0] === "Norte")?.total).toBe(1)
    expect(resultado.total).toBe(2)
    expect(resultado.totaisColuna).toEqual([2, 1])
  })

  it("aplica categoria selecionada e protege células CSV contra fórmulas e quebra de linha", () => {
    const dados = [linha({ interjornada: 4, ferias_com_ponto: 2 })]
    const filtrado = montarPivotConformidade(dados, { linha: "cr", coluna: "mes", metrica: "ocorrencias", tipo: "ferias_com_ponto" })
    expect(filtrado.total).toBe(2)
    expect(filtrado.linhas[0]?.valores).toEqual([2])
    expect(gerarCsvSeguro([["=1+1", "nome, composto", "linha\nseguinte", '"aspas"']])).toBe('"\'=1+1","nome, composto","\'linha\nseguinte","""aspas"""')
  })
})
