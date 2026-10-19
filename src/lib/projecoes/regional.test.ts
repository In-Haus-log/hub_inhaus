import { beforeEach, describe, expect, it, vi } from "vitest"
const db = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock("@/lib/db-inhaus", () => ({ inhausPool: db }))
import { escopoRegionalProjecoes, GERENTE_REGIONAL_PROJECOES } from "./regional"
describe("Regional Lucas", () => {
  beforeEach(() => vi.resetAllMocks())
  it("limita o acesso geral aos CRs da regional", async () => {
    db.query.mockResolvedValue({ rows: [{ cr: "40703" }] })
    expect(await escopoRegionalProjecoes({ tipo: "todos" })).toEqual({ tipo: "lista", crs: ["40703"] })
    expect(db.query.mock.calls[0][1]).toEqual([GERENTE_REGIONAL_PROJECOES])
  })
  it("intersecta a regional com a carteira do usuário", async () => {
    db.query.mockResolvedValue({ rows: [] })
    expect(await escopoRegionalProjecoes({ tipo: "lista", crs: ["99999"] })).toEqual({ tipo: "lista", crs: [] })
    expect(db.query.mock.calls[0][1]).toEqual([GERENTE_REGIONAL_PROJECOES, ["99999"]])
  })
  it("bloqueia CR fora da carteira mesmo se a consulta retornar outra linha", async () => {
    db.query.mockResolvedValue({ rows: [{ cr: "99999" }] })
    await expect(escopoRegionalProjecoes({ tipo: "lista", crs: ["40703"] })).rejects.toThrow()
  })
})
