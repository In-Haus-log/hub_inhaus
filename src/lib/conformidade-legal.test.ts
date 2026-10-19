import { beforeEach, describe, expect, it, vi } from "vitest"

const queryMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/db-inhaus", () => ({ inhausPool: { query: queryMock } }))

import { getConformidadeLegal, TYPES_OCORRENCIA } from "./conformidade-legal"

const linha = (extra: Record<string, unknown> = {}) => ({
  competencia: "2026-08-01", cr_cod: "24238", cr_nome: "24238 - CR A",
  gerente_regional: "REGIONAL", gerente: "GERENTE", supervisor: "SUPERVISOR",
  funcao: "AUXILIAR", colaborador_nome: "PESSOA", cpf_hash: "segredo-hash",
  interjornada: 1, limite_hr_dia: null, limite_hr_dia_excecao: 2,
  folga_semanal: 0, x12x36_limite_ft_mes: null, ferias_com_ponto: null,
  total_ocorrencias: 3, importado_em: "2026-10-07T12:00:00.000Z", extraido_em: null,
  ...extra,
})

describe("conformidade legal", () => {
  beforeEach(() => queryMock.mockReset())

  it("serializa mês, ocorrências e pessoas distintas sem expor hash ou identificador interno", async () => {
    queryMock.mockResolvedValue({ rows: [linha(), linha({ competencia: "2026-09-01", total_ocorrencias: 1 }), linha({ cpf_hash: "outro-hash", colaborador_nome: "OUTRA PESSOA" })] })
    const dados = await getConformidadeLegal({ tipo: "todos" })
    expect(dados.linhas).toHaveLength(3)
    expect(dados.linhas.map((r) => r.mes)).toEqual(["2026-08", "2026-09", "2026-08"])
    expect(dados.linhas[0]?.pessoaId).toBe(dados.linhas[1]?.pessoaId)
    expect(dados.linhas[0]?.pessoaId).not.toBe(dados.linhas[2]?.pessoaId)
    expect(dados.linhas[0]).toMatchObject({ cr: "24238", crNome: "24238 - CR A", regional: "REGIONAL", total: 3, interjornada: 1 })
    expect(JSON.stringify(dados)).not.toContain("segredo-hash")
    expect(JSON.stringify(dados)).not.toContain("outro-hash")
    expect(dados.atualizadoEm).toBe("2026-10-07T12:00:00.000Z")
    expect(TYPES_OCORRENCIA).toHaveLength(6)
    expect(Object.keys(dados.linhas[0] ?? {})).not.toContain("cpf_hash")
  })

  it("aplica predicado de CR e verifica o escopo na saída", async () => {
    queryMock.mockResolvedValue({ rows: [linha()] })
    await getConformidadeLegal({ tipo: "lista", crs: ["24238"] })
    const sql = String(queryMock.mock.calls[0]?.[0])
    expect(sql).toContain("any($1::text[])")
    expect(queryMock.mock.calls[0]?.[1]).toEqual([["24238"]])

    queryMock.mockResolvedValue({ rows: [linha({ cr_cod: "99999" })] })
    await expect(getConformidadeLegal({ tipo: "lista", crs: ["24238"] })).rejects.toThrow("fora do escopo")
  })

  it("falha fechado sem consultar o banco quando o escopo não contém CRs", async () => {
    await expect(getConformidadeLegal({ tipo: "lista", crs: [] })).resolves.toEqual({ linhas: [], atualizadoEm: null })
    expect(queryMock).not.toHaveBeenCalled()
  })
})
