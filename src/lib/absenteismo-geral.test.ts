import { beforeEach, describe, expect, it, vi } from "vitest"

const queryMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/db-inhaus", () => ({ inhausPool: { query: queryMock } }))

import { agregarAbsenteismo, absenteismoPercentual, getAbsenteismo, getOpcoesAbsenteismo } from "./absenteismo-geral"

const ponto = (extra: Record<string, unknown> = {}) => ({
  id: null,
  matricula: "M1",
  colaborador: "Pessoa",
  data: "2026-09-01",
  entrada: "08:00",
  h_contratual: null,
  motivo_abono_dispensa: null,
  cr: "12345 - CR",
  gerente: "GERENTE A",
  cargo: "AUXILIAR",
  ...extra,
})

describe("absenteísmo geral", () => {
  beforeEach(() => queryMock.mockReset())
  it("conta colaboradores, faltas e percentual ponderado", () => {
    const dados = agregarAbsenteismo([
      ponto(),
      ponto({ id: 2, matricula: "M2", entrada: "FALTA", data: "2026-09-01" }),
      ponto({ id: 3, matricula: "M3", entrada: "FALTA", data: "2026-09-02", gerente: null }),
    ])
    expect(dados.colaboradores).toBe(3)
    expect(dados.presencas).toBe(1)
    expect(dados.faltas).toBe(2)
    expect(dados.escalados).toBe(3)
    expect(dados.absenteismo).toBe(66.7)
    expect(dados.porDia).toEqual(expect.arrayContaining([
      expect.objectContaining({ rotulo: "2026-09-01", presencas: 1, faltas: 1, escalados: 2 }),
    ]))
    expect(dados.porGerente).toEqual(expect.arrayContaining([
      expect.objectContaining({ rotulo: "Sem gerente", faltas: 1 }),
    ]))
  })

  it("não duplica a mesma linha de ponto quando o identificador não existe", () => {
    const dados = agregarAbsenteismo([ponto(), ponto()])
    expect(dados.escalados).toBe(1)
    expect(dados.colaboradores).toBe(1)
  })

  it("preserva linhas com matrícula nula e usa Sem gerente", () => {
    const dados = agregarAbsenteismo([ponto({ matricula: null, colaborador: null, gerente: null, entrada: "FALTA" })])
    expect(dados.colaboradores).toBe(1)
    expect(dados.porGerente[0]?.rotulo).toBe("Sem gerente")
  })

  it("não cria absenteísmo com denominador zero", () => {
    expect(absenteismoPercentual(4, 0)).toBe(0)
    expect(agregarAbsenteismo([ponto({ entrada: null }), ponto({ id: 2, entrada: "FOLGA" })]).escalados).toBe(0)
  })

  it("pondera o período por faltas e escalados, sem média simples dos dias", () => {
    const dados = agregarAbsenteismo([
      ponto({ id: 1, data: "2026-09-01" }),
      ponto({ id: 2, data: "2026-09-01", entrada: "FALTA", matricula: "M2" }),
      ponto({ id: 3, data: "2026-09-02", entrada: "FALTA", matricula: "M3" }),
    ])
    expect(dados.absenteismo).toBe(66.7)
    expect(dados.porDia.map((x) => x.absenteismo)).toEqual([50, 100])
  })

  it("conta a mesma matrícula uma vez mesmo quando há transferência de CR", () => {
    const dados = agregarAbsenteismo([
      ponto({ id: 1, cr: "12345 - A" }),
      ponto({ id: 2, cr: "12346 - B", data: "2026-09-02" }),
    ])
    expect(dados.colaboradores).toBe(1)
  })

  it("aplica corte D-1, filtros e isolamento na consulta", async () => {
    queryMock.mockResolvedValue({ rows: [] })
    await getAbsenteismo({ mes: "2026-09", gerentes: ["G"], crs: ["12345"], cargos: ["A"] }, { tipo: "lista", crs: ["12345"] })
    const sql = String(queryMock.mock.calls[0]?.[0])
    expect(sql).toContain("ft_desligados")
    expect(sql).toContain("dt_demissao <")
    expect(sql).toContain("p.data")
    expect(sql).toContain("any($3::text[])")
    expect(sql).toContain("any($4::text[])")
    expect(sql).toContain("any($5::text[])")
    expect(queryMock.mock.calls[0]?.[1]).toEqual(expect.arrayContaining([expect.arrayContaining(["12345"])]))
  })

  it("falha fechado para escopo vazio nas opções", async () => {
    queryMock.mockResolvedValue({ rows: [] })
    const opcoes = await getOpcoesAbsenteismo({ tipo: "lista", crs: [] })
    expect(opcoes).toEqual({ meses: [], gerentes: [], crs: [], cargos: [] })
    expect(queryMock).not.toHaveBeenCalled()
  })
})
