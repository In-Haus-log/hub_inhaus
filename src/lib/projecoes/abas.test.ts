import { describe, expect, it } from "vitest"
import { abaDoItem, numeroEntrada, numeroTexto, tipoDaAba } from "./abas"
import { itemSchema } from "@/lib/flash/validacao"
describe("Estruturas de projeções", () => {
  it("mantém glosas e horas extras na aba contábil correta", () => {
    expect(abaDoItem({ tipo: "DESCONTO" })).toBe("Glosas")
    expect(abaDoItem({ tipo: "HORA_EXTRA" })).toBe("Hora Extra")
    expect(abaDoItem({ tipo: "FIXO" })).toBe("Variáveis")
  })
  it("aceita pessoas por dia sem converter uma tarifa mensal", () => {
    expect(tipoDaAba("Pessoas", "Dias")).toBe("UNITARIO")
    expect(tipoDaAba("Pessoas", "Pessoas")).toBe("PESSOAS")
  })
  it("preserva precisão ao editar tarifas proporcionais", () => {
    const valor = 1077.301589364
    expect(numeroEntrada(numeroTexto(valor))).toBe(valor)
    expect(Number.isNaN(numeroEntrada(""))).toBe(true)
    expect(Number.isNaN(numeroEntrada("1.200,00"))).toBe(true)
  })
  it("recusa quantidades fracionadas de pessoas no cadastro", () => {
    expect(itemSchema.safeParse({ descricao: "Posto", tipo: "PESSOAS", valorUnitario: 100, qtdPadrao: 1.5 }).success).toBe(false)
  })
  it("recusa metadados de glosa associados a receita positiva", () => {
    expect(itemSchema.safeParse({ descricao: "Glosa", agrupador: "Embalagem / Tarde", tipo: "UNITARIO", valorUnitario: 10, qtdPadrao: 1, parametros: { aba: "Glosas", unidadeMedida: "Horas", remuneracao: "VARIAVEL", turno: null } }).success).toBe(false)
  })
  it("exige Área / Turno nos novos itens", () => {
    const dados = { descricao: "HE", tipo: "HORA_EXTRA", valorUnitario: 40, qtdPadrao: 2, parametros: { aba: "Hora Extra", unidadeMedida: "Horas", remuneracao: "VARIAVEL", turno: null } }
    expect(itemSchema.safeParse(dados).success).toBe(false)
    expect(itemSchema.safeParse({ ...dados, agrupador: "Embalagem / Tarde" }).success).toBe(true)
    expect(itemSchema.safeParse({ ...dados, agrupador: "   " }).success).toBe(false)
  })
  it("aceita HE consolidada sem inventar horas", () => {
    expect(itemSchema.safeParse({ descricao: "HE", agrupador: "Forno / Tarde", tipo: "HORA_EXTRA", valorUnitario: 3779.4, qtdPadrao: 1, parametros: { aba: "Hora Extra", unidadeMedida: "Verba", remuneracao: "VARIAVEL", turno: null } }).success).toBe(true)
  })
  it("recusa unidade incompatível com HE", () => {
    expect(itemSchema.safeParse({ descricao: "HE", agrupador: "Embalagem", tipo: "HORA_EXTRA", valorUnitario: 40, qtdPadrao: 2, parametros: { aba: "Hora Extra", unidadeMedida: "Peças", remuneracao: "VARIAVEL", turno: null } }).success).toBe(false)
  })

})
