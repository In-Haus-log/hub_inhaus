import { describe, expect, it } from "vitest"
import { agregarDashboardGps, type LinhaGps } from "./absenteismo-gps"

const linha = (mes: string, cpf: string, dados: Partial<LinhaGps> = {}): LinhaGps => ({
  competencia: `${mes}-01`, gerente: "GERENTE A", cr_codigo: "00123", cr_nome: "00123 - UNIDADE",
  cpf_hash: cpf, colaborador_nome: cpf, vl_ausencias_descontadas: 0,
  vl_ausencias_abonadas: 0, vl_devolucoes: 0, total_ausencias_devolucoes: 0,
  vl_verbas_salariais: 0, ...dados,
})

describe("agregarDashboardGps", () => {
  it("calcula taxas ponderadas pelos valores e não pela média das taxas individuais", () => {
    const dados = agregarDashboardGps([
      linha("2026-08", "um", { vl_ausencias_descontadas: 10, total_ausencias_devolucoes: 10, vl_verbas_salariais: 100, importado_em: "2026-09-04T12:00:00Z" }),
      linha("2026-08", "dois", { vl_ausencias_descontadas: 90, vl_ausencias_abonadas: 10, vl_devolucoes: 20, total_ausencias_devolucoes: 80, vl_verbas_salariais: 900, importado_em: "2026-09-05T12:00:00Z" }),
    ], { mes: "2026-08" })

    expect(dados.atual).toEqual({
      geral: 9, injustificado: 8, justificado: 1, colaboradores: 2,
      descontadas: 100, abonadas: 10, devolucoes: 20, verbas: 1000,
    })
    expect(dados.atualizadoEm).toBe("2026-09-05T12:00:00Z")
  })

  it("mantém taxas nulas para verba zero, correções negativas e mês sem linhas", () => {
    const dados = agregarDashboardGps([
      linha("2026-06", "um", { vl_ausencias_descontadas: -5, vl_devolucoes: 2, total_ausencias_devolucoes: -7, vl_verbas_salariais: 0 }),
    ], { mes: "2026-07" })

    expect(dados.atual).toMatchObject({ geral: null, injustificado: null, justificado: null, colaboradores: 0 })
    expect(dados.anterior).toMatchObject({ geral: null, descontadas: -5 })
    expect(dados.evolucao).toHaveLength(12)
    expect(dados.evolucao.find((m) => m.mes === "2026-05")).toMatchObject({ geral: null, colaboradores: 0 })
    expect(dados.evolucao.find((m) => m.mes === "2026-06")?.geral).toBeNull()
  })

  it("conta a pessoa uma vez no resumo mesmo com transferência entre CRs", () => {
    const dados = agregarDashboardGps([
      linha("2026-09", "hash-unico", { cr_codigo: "00123", vl_verbas_salariais: 100 }),
      linha("2026-09", "hash-unico", { cr_codigo: "00456", cr_nome: "00456 - OUTRA UNIDADE", vl_ausencias_descontadas: 2, vl_verbas_salariais: 100 }),
    ], { mes: "2026-09" })

    expect(dados.atual.colaboradores).toBe(1)
    expect(dados.colaboradores).toHaveLength(2)
    expect(dados.colaboradores[0].id).not.toContain("hash-unico")
    expect(dados.colaboradores[0]).not.toHaveProperty("cpf_hash")
  })

  it("aplica gerente e CR ao resumo, evolução, comparação e lista", () => {
    const dados = agregarDashboardGps([
      linha("2026-08", "incluido", { vl_verbas_salariais: 100 }),
      linha("2026-08", "fora", { gerente: "GERENTE B", vl_verbas_salariais: 500 }),
      linha("2026-09", "outro-cr", { cr_codigo: "00456", vl_verbas_salariais: 300 }),
    ], { mes: "2026-09", gerente: "GERENTE A", cr: "00123" })

    expect(dados.atual.colaboradores).toBe(0)
    expect(dados.anterior?.colaboradores).toBe(1)
    expect(dados.evolucao.find((m) => m.mes === "2026-08")?.colaboradores).toBe(1)
    expect(dados.colaboradores).toEqual([])
  })
})
