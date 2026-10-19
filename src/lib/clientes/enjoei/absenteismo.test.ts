import { beforeEach, describe, it, expect, vi } from "vitest"

const queryMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/db-inhaus", () => ({ inhausPool: { query: queryMock } }))

import {
  classificar,
  getHeadcount,
  getMaxAllowedDate,
  getMesesDisponiveis,
  getPresencasTimeline,
} from "./absenteismo"

describe("classificar", () => {
  it("hora de entrada = presente", () => {
    expect(classificar("08:04", null, null)).toBe("presente")
  })
  it("FALTA = falta", () => {
    expect(classificar("FALTA", null, null)).toBe("falta")
  })
  it("h_contratual FOLGA = folga", () => {
    expect(classificar(null, "FOLGA", null)).toBe("folga")
  })
  it("motivo FÉRIAS = ferias", () => {
    expect(classificar(null, null, "FÉRIAS")).toBe("ferias")
  })
})

describe("getMaxAllowedDate", () => {
  it("retorna YYYY-MM-DD", () => {
    expect(getMaxAllowedDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe("corte de desligamento nas consultas", () => {
  beforeEach(() => queryMock.mockReset())

  it("reutiliza o mesmo helper nas três leituras e conserva o limite D-1", async () => {
    queryMock.mockResolvedValue({ rows: [] })

    await getMesesDisponiveis()
    await getHeadcount("2026-09")
    await getPresencasTimeline("2026-09")

    expect(queryMock).toHaveBeenCalledTimes(3)
    for (const [sql] of queryMock.mock.calls) {
      expect(sql).toContain("public.ft_desligados")
      expect(sql).toContain("fd.dt_demissao < p.data")
      expect(sql).toContain("p.data <=")
      expect(sql).toContain("not exists")
      expect(sql).toContain("fd.matricula = btrim(p.matricula)")
      expect(sql).toContain("fd.cr_codigo = lpad")
    }
  })

  it("mantém o denominador da timeline baseado somente nas linhas liberadas pelo corte", async () => {
    // Fixture já reduzida pelo banco: antes e no dia do desligamento entram;
    // depois dele não entra, e vínculo sem data continua aberto.
    queryMock.mockResolvedValue({
      rows: [
        { iso: "2026-09-10", presentes: "2", faltas: "1", cr: "68732 - SP - LOG - ENJOEI - CABREUVA" },
        { iso: "2026-09-11", presentes: "1", faltas: "1", cr: "68732 - SP - LOG - ENJOEI - CABREUVA" },
      ],
    })

    const resultado = await getPresencasTimeline("2026-09")
    expect(resultado.pontos.find((p) => p.dia === "10")).toMatchObject({
      presentes: 2,
      faltas: 1,
      escalados: 3,
    })
    expect(resultado.pontos.find((p) => p.dia === "11")).toMatchObject({
      presentes: 1,
      faltas: 1,
      escalados: 2,
    })
    expect(resultado.pontos.find((p) => p.dia === "12")).toMatchObject({
      presentes: 0,
      faltas: 0,
      escalados: 0,
    })
  })

})
