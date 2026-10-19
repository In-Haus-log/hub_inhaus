import { beforeEach, describe, expect, it, vi } from "vitest"
const db = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }))
vi.mock("@/lib/db-inhaus", () => ({ inhausPool: db }))
import { crsDoPec } from "./catalogo"
import { listarVisao } from "./visao"
import { salvarItem } from "@/lib/flash/dados"
describe("PECs da tabela de CRs", () => {
  beforeEach(() => vi.resetAllMocks())
  it("consulta CRs por PEC e pela carteira do usuário", async () => {
    db.query.mockResolvedValue({ rows: [{ cr: "40703", nome: "Operação", pec_cod: "031472", gerente: null, cliente: "Cliente" }] })
    expect((await crsDoPec({ tipo: "lista", crs: ["40703"] }, "031472"))[0].pecCod).toBe("031472")
    expect(db.query.mock.calls[0][0]).toContain("btrim(c.pec)=$1")
    expect(db.query.mock.calls[0][1]).toEqual(["031472", ["40703"]])
  })
  it("nega saída de CR fora da carteira mesmo se a consulta falhar no filtro", async () => {
    db.query.mockResolvedValue({ rows: [{ cr: "99999", pec_cod: "031472" }] })
    await expect(crsDoPec({ tipo: "lista", crs: ["40703"] }, "031472")).rejects.toThrow()
  })
  it("retorna carteira vazia sem abrir acesso geral", async () => {
    db.query.mockResolvedValue({ rows: [] })
    expect(await crsDoPec({ tipo: "lista", crs: [] }, "031472")).toEqual([])
    expect(db.query.mock.calls[0][0]).toContain("and 1=0")
  })
  it("recusa gravar CR de outro PEC, mesmo com acesso a esse CR", async () => {
    db.query.mockResolvedValue({ rows: [{ cr: "40703", nome: "Operação", pec_cod: "031472" }] })
    await expect(salvarItem({ tipo: "todos" }, "031472", { descricao: "Posto", tipo: "PESSOAS", natureza: "RECEITA", valorUnitario: 100, qtdPadrao: 1, crCod: "99999", agrupador: "Tarde", ordem: 0 })).rejects.toThrow("Este CR não pertence ao PEC selecionado.")
    expect(db.connect).not.toHaveBeenCalled()
    expect(db.query.mock.calls.every(c => !/insert|update/i.test(c[0]))).toBe(true)
  })
  it("a lista usa dm_cr e não exige habilitação prévia", async () => {
    db.query.mockResolvedValue({ rows: [{ pec_cod: "031472", pec_nome: "Cliente", cr_cod: "40703", crs: ["40703", "40704"], status: null, rol: null, custos: null }] })
    const pecs = await listarVisao({ tipo: "todos" }, { mes: "2026-10", semana: 1 })
    expect(pecs).toHaveLength(1)
    expect(pecs[0].crs).toEqual(["40703", "40704"])
    expect(pecs[0].status).toBe("PENDENTE")
    expect(db.query.mock.calls[0][0]).toContain("from public.dm_cr c")
    expect(db.query.mock.calls[0][0]).not.toContain("where p.ativo")
  })
  it("confere o escopo também nos CRs secundários do PEC", async () => {
    db.query.mockResolvedValue({ rows: [{ cr_cod: "40703", crs: ["40703", "99999"] }] })
    await expect(listarVisao({ tipo: "lista", crs: ["40703"] }, { mes: "2026-10", semana: 1 })).rejects.toThrow()
  })
})
