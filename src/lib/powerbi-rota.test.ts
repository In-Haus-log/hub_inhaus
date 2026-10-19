import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), dev: vi.fn(), query: vi.fn() }))

vi.mock("@/lib/auth-session", () => ({ requireSession: mocks.requireSession }))
vi.mock("@/lib/dev-auth", () => ({ acessoLivreLiberado: mocks.dev }))
vi.mock("@/lib/powerbi-db", () => ({ powerbiDb: { query: mocks.query } }))

import { DELETE, GET, PATCH, POST } from "@/app/api/powerbi/route"

const respostaNegada = () => ({ ok: false, response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) })
const sessao = (authorization: Record<string, unknown>) => ({ ok: true, sessao: { authorization } })
const admin = () => sessao({ email: "admin@hub.test", isAdmin: true, isAnalista: false, visibleScreens: [] })
const requestPost = (body: unknown) => new Request("https://hub.test/api/powerbi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
const requestPatch = (body: unknown) => new Request("https://hub.test/api/powerbi", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
const requestDelete = (id = 7, tipo?: string) => new Request(`https://hub.test/api/powerbi?${tipo ? `tipo=${tipo}&` : ""}id=${id}`, { method: "DELETE" })
const cliente = (id: number) => ({ id, nome: `Cliente ${id}`, slug: `cliente-${id}` })
const painel = (id: number, clienteId: number, titulo = "Relatório") => ({ id, clienteId, titulo, url: "https://app.powerbi.com/view?r=abc", documentacao: "" })

describe("autorização e operações da rota Power BI", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.dev.mockReturnValue(false)
    mocks.query.mockResolvedValue({ rows: [], rowCount: 1 })
    mocks.requireSession.mockResolvedValue(respostaNegada())
  })

  it("nega anônimo em leitura e escrita sem consultar o banco", async () => {
    expect((await GET()).status).toBe(401)
    expect((await POST(requestPost({ clienteId: 2, titulo: "Operação", url: "https://app.powerbi.com/view?r=a" }))).status).toBe(401)
    expect((await DELETE(requestDelete())).status).toBe(401)
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it("sem telas concedidas retorna listas vazias e nega escrita", async () => {
    mocks.requireSession.mockResolvedValue(sessao({ email: "user@hub.test", isAdmin: false, isAnalista: false, visibleScreens: [] }))
    const leitura = await GET()
    expect(leitura.status).toBe(200)
    expect(await leitura.json()).toEqual({ clientes: [], paineis: [] })
    expect((await POST(requestPost({ clienteId: 2, titulo: "Operação", url: "https://app.powerbi.com/view?r=a" }))).status).toBe(403)
    expect((await DELETE(requestDelete())).status).toBe(403)
    expect((await PATCH(requestPatch({ id: 7, clienteId: 2, titulo: "Atualizado", url: "https://app.powerbi.com/view?r=a" }))).status).toBe(403)
    expect(mocks.query).toHaveBeenCalledTimes(2)
  })

  it("não transforma a permissão Power BI genérica em escopo de cliente", async () => {
    mocks.requireSession.mockResolvedValue(sessao({ email: "viewer@hub.test", isAdmin: false, isAnalista: false, visibleScreens: ["powerbi"] }))
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ clientes: [], paineis: [] })
    expect(mocks.query).toHaveBeenNthCalledWith(1, expect.stringContaining("FROM cliente_contratante"), [false, []])
    expect(mocks.query).toHaveBeenNthCalledWith(2, expect.stringContaining("FROM dm_powerbi_painel"), [false, []])
  })

  it("analista sem chave cliente-bi vê resposta vazia", async () => {
    mocks.requireSession.mockResolvedValue(sessao({ email: "analista@hub.test", isAdmin: false, isAnalista: true, visibleScreens: ["powerbi"] }))
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ clientes: [], paineis: [] })
    expect(mocks.query).toHaveBeenCalledTimes(2)
  })

  it("retorna clientes e painéis apenas no escopo permitido", async () => {
    mocks.requireSession.mockResolvedValue(sessao({ email: "analista@hub.test", isAdmin: false, isAnalista: true, visibleScreens: ["cliente-bi:4"] }))
    mocks.query.mockResolvedValueOnce({ rows: [cliente(4)], rowCount: 1 }).mockResolvedValueOnce({ rows: [painel(8, 4)], rowCount: 1 })
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ clientes: [cliente(4)], paineis: [painel(8, 4)] })
    expect(mocks.query).toHaveBeenNthCalledWith(1, expect.stringContaining("FROM cliente_contratante"), [false, [4]])
    expect(mocks.query).toHaveBeenNthCalledWith(2, expect.stringContaining("FROM dm_powerbi_painel"), [false, [4]])
  })

  it("aplica a segunda barreira e não retorna painel de cliente fora do escopo", async () => {
    mocks.requireSession.mockResolvedValue(sessao({ email: "analista@hub.test", isAdmin: true, isAnalista: true, visibleScreens: ["cliente-bi:4"] }))
    mocks.query.mockResolvedValueOnce({ rows: [cliente(4)], rowCount: 1 }).mockResolvedValueOnce({ rows: [painel(9, 5, "Vazado")], rowCount: 1 })
    const response = await GET()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Não foi possível carregar os relatórios." })
  })

  it("exige clienteId ao criar painel e rejeita contrato antigo de segmento", async () => {
    mocks.requireSession.mockResolvedValue(sessao({ email: "analista@hub.test", isAdmin: false, isAnalista: true, visibleScreens: ["cliente-bi:4"] }))
    expect((await POST(requestPost({ titulo: "Operação", url: "https://app.powerbi.com/view?r=a" }))).status).toBe(400)
    expect((await POST(requestPost({ tipo: "segmento", clienteId: 4, titulo: "Operação", url: "https://app.powerbi.com/view?r=a" }))).status).toBe(400)
    expect(mocks.query).not.toHaveBeenCalled()
    const response = await POST(requestPost({ clienteId: 4, titulo: "Operação", url: "https://app.powerbi.com/view?r=a" }))
    expect(response.status).toBe(201)
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO dm_powerbi_painel"), [4, "Operação", "https://app.powerbi.com/view?r=a", false, [4], "", "layout-dashboard"])
  })

  it("restringe alteração pelo cliente de origem e destino e DELETE legado segmento é inválido", async () => {
    mocks.requireSession.mockResolvedValue(sessao({ email: "analista@hub.test", isAdmin: false, isAnalista: true, visibleScreens: ["cliente-bi:4"] }))
    mocks.query.mockResolvedValue({ rows: [], rowCount: 0 })
    const patch = await PATCH(requestPatch({ id: 7, clienteId: 5, titulo: "Atualizado", url: "https://app.powerbi.com/view?r=a" }))
    expect(patch.status).toBe(404)
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE dm_powerbi_painel"), [7, "Atualizado", "https://app.powerbi.com/view?r=a", 5, false, [4], null, null])
    expect((await DELETE(requestDelete(7, "segmento"))).status).toBe(400)
    const del = await DELETE(requestDelete(11))
    expect(del.status).toBe(404)
    expect(mocks.query).toHaveBeenLastCalledWith(expect.stringContaining("DELETE FROM dm_powerbi_painel"), [11, false, [4]])
  })

  it("permite admin listar, criar, editar e excluir sem restringir clientes", async () => {
    mocks.requireSession.mockResolvedValue(admin())
    await GET()
    await POST(requestPost({ clienteId: 3, titulo: "Operação", url: "https://app.powerbi.com/view?r=a" }))
    await PATCH(requestPatch({ id: 7, clienteId: 3, titulo: "Atualizado", url: "https://app.powerbi.com/view?r=a" }))
    await DELETE(requestDelete())
    expect(mocks.query).toHaveBeenNthCalledWith(1, expect.stringContaining("FROM cliente_contratante"), [true, []])
    expect(mocks.query).toHaveBeenNthCalledWith(2, expect.stringContaining("FROM dm_powerbi_painel"), [true, []])
    expect(mocks.query).toHaveBeenNthCalledWith(3, expect.stringContaining("INSERT INTO dm_powerbi_painel"), [3, "Operação", "https://app.powerbi.com/view?r=a", true, [], "", "layout-dashboard"])
    expect(mocks.query).toHaveBeenNthCalledWith(4, expect.stringContaining("UPDATE dm_powerbi_painel"), [7, "Atualizado", "https://app.powerbi.com/view?r=a", 3, true, [], null, null])
    expect(mocks.query).toHaveBeenNthCalledWith(5, expect.stringContaining("DELETE FROM dm_powerbi_painel"), [7, true, []])
  })
})
