import { describe, expect, it } from "vitest"
import {
  ALIQUOTA_PADRAO, aliquotaDoHistorico, alteracoes, margemPct, montarSemanaNova, receitaBruta, resumoSemana, TIPOS_POR_NATUREZA, receitaLiquida, valorLinha, type Item,
} from "./calculos"

const item = (p: Partial<Item> & { id: number }): Item => ({
  descricao: "x", tipo: "PESSOAS", natureza: "RECEITA", crCod: "12345", valorUnitario: 100, qtdPadrao: 1,
  agrupador: null, ordem: 0, ativo: true, ...p,
})

describe("valorLinha", () => {
  it("pessoas = tarifa × pessoas", () => expect(valorLinha("PESSOAS", 6978.41, 15)).toBeCloseTo(104676.15, 2))
  it("desconto entra negativo", () => expect(valorLinha("DESCONTO", 50, 10)).toBe(-500))
  it("fixo = valor × quantidade", () => expect(valorLinha("FIXO", 900, 1)).toBe(900))
})

describe("receitas", () => {
  const itens = [item({ id: 1, valorUnitario: 1000 }), item({ id: 2, tipo: "DESCONTO", valorUnitario: 100 })]
  it("bruta soma as linhas usando o valor congelado da linha", () => {
    expect(receitaBruta(itens, [
      { itemId: 1, valorUnitario: 1000, quantidade: 3 },
      { itemId: 2, valorUnitario: 100, quantidade: 2 },
    ])).toBe(2800)
  })
  it("líquida desconta a alíquota; exemplo do info: 1.000.000 × 11,5% = 885.000", () => {
    expect(receitaLiquida(1_000_000, 0.115)).toBe(885_000)
  })
  it("alíquota do histórico = impostos ÷ bruta; sem histórico usa a padrão", () => {
    expect(aliquotaDoHistorico(1_000_000, -115_000)).toBeCloseTo(0.115)
    expect(aliquotaDoHistorico(0, 0)).toBe(ALIQUOTA_PADRAO)
    expect(aliquotaDoHistorico(1000, 0)).toBe(0)
  })
})

describe("montarSemanaNova", () => {
  it("copia quantidades da última enviada, usa tarifa VIGENTE e ignora item desativado", () => {
    const itens = [
      item({ id: 1, valorUnitario: 110, qtdPadrao: 9 }),
      item({ id: 2, ativo: false }),
      item({ id: 3, valorUnitario: 50, qtdPadrao: 4 }),
    ]
    const ultima = [
      { itemId: 1, valorUnitario: 100, quantidade: 15 },
      { itemId: 2, valorUnitario: 100, quantidade: 7 },
    ]
    expect(montarSemanaNova(itens, ultima)).toEqual([
      { itemId: 1, valorUnitario: 110, quantidade: 15 },
      { itemId: 3, valorUnitario: 50, quantidade: 4 },
    ])
  })
  it("sem semana enviada usa a quantidade padrão", () => {
    expect(montarSemanaNova([item({ id: 1, qtdPadrao: 7 })], null)).toEqual([{ itemId: 1, valorUnitario: 100, quantidade: 7 }])
  })
})

describe("alteracoes", () => {
  it("lista só o que mudou vs. semana anterior", () => {
    const ant = [{ itemId: 1, valorUnitario: 1, quantidade: 15 }, { itemId: 2, valorUnitario: 1, quantidade: 4 }]
    const atual = [{ itemId: 1, valorUnitario: 1, quantidade: 13 }, { itemId: 2, valorUnitario: 1, quantidade: 4 }, { itemId: 3, valorUnitario: 1, quantidade: 2 }]
    expect(alteracoes(atual, ant)).toEqual([{ itemId: 1, de: 15, para: 13 }, { itemId: 3, de: 0, para: 2 }])
  })
  it("sem semana anterior não há alterações", () => expect(alteracoes([{ itemId: 1, valorUnitario: 1, quantidade: 3 }], null)).toEqual([]))
})

describe("custo e margem", () => {
  const itens = [
    item({ id: 1, natureza: "RECEITA", tipo: "PESSOAS", valorUnitario: 1000 }),
    item({ id: 2, natureza: "CUSTO", tipo: "HORA_EXTRA", valorUnitario: 50 }),
    item({ id: 3, natureza: "CUSTO", tipo: "TAXA", valorUnitario: 200 }),
  ]
  const linhas = [
    { itemId: 1, valorUnitario: 1000, quantidade: 10 }, // 10.000 de receita
    { itemId: 2, valorUnitario: 50, quantidade: 20 },   // 1.000 de custo
    { itemId: 3, valorUnitario: 200, quantidade: 1 },   //   200 de custo
  ]
  it("receitaBruta ignora itens de custo", () => expect(receitaBruta(itens, linhas)).toBe(10_000))
  it("resumo: ROL = bruta × (1 − alíquota); MC = ROL − custos", () => {
    const r = resumoSemana(itens, linhas, 0.1)
    expect(r.bruta).toBe(10_000)
    expect(r.rol).toBe(9_000)
    expect(r.custos).toBe(1_200)
    expect(r.mc).toBe(7_800)
    expect(r.margem).toBeCloseTo(7_800 / 9_000)
  })
  it("linha de item desconhecido é ignorada", () => {
    expect(resumoSemana(itens, [{ itemId: 99, valorUnitario: 5, quantidade: 5 }], 0.1).bruta).toBe(0)
  })
  it("margem é nula quando o ROL é zero (nunca NaN/Infinity)", () => {
    expect(margemPct(-500, 0)).toBeNull()
    expect(resumoSemana(itens, [{ itemId: 2, valorUnitario: 50, quantidade: 20 }], 0.1).margem).toBeNull()
  })
  it("desconto é receita negativa; custo nunca é DESCONTO", () => {
    expect(TIPOS_POR_NATUREZA.CUSTO).not.toContain("DESCONTO")
    expect(TIPOS_POR_NATUREZA.RECEITA).not.toContain("TAXA")
    expect(TIPOS_POR_NATUREZA.CUSTO).toEqual(expect.arrayContaining(["HORA_EXTRA", "TAXA", "VARIAVEL"]))
  })
})
