import { loadEnvConfig } from "@next/env"
import { randomUUID } from "node:crypto"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), dev: vi.fn(), query: vi.fn() }))

vi.mock("@/lib/auth-session", () => ({ requireSession: mocks.requireSession }))
vi.mock("@/lib/dev-auth", () => ({ acessoLivreLiberado: mocks.dev }))
vi.mock("@/lib/powerbi-db", () => ({ powerbiDb: { query: mocks.query } }))

import { DELETE, GET, PATCH, POST } from "@/app/api/powerbi/route"

const habilitado = process.env.TEST_POWERBI_DB === "1"
const suite = describe.skipIf(!habilitado)

let db: Client | undefined
let clienteA: number
let clienteB: number
let painelA: number
let painelB: number
const nomeTemporario = `powerbi-test-${randomUUID()}`

function autenticar(authorization: Record<string, unknown>) {
  mocks.requireSession.mockResolvedValue({ ok: true, sessao: { authorization } })
}

function request(body: unknown, method: "POST" | "PATCH") {
  return new Request("https://hub.test/api/powerbi", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

suite("isolamento Power BI por cliente (PostgreSQL real)", () => {
  beforeAll(async () => {
    loadEnvConfig(process.cwd())
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL é obrigatório com TEST_POWERBI_DB=1")
    db = new Client({ connectionString: process.env.DATABASE_URL })
    await db.connect()
    await db.query("BEGIN")

    const a = await db.query<{ id: number }>(
      "INSERT INTO cliente_contratante(nome,slug,ativo) VALUES ($1,$2,true) RETURNING id",
      [`${nomeTemporario}-a`, `${nomeTemporario}-a`],
    )
    clienteA = a.rows[0].id
    const b = await db.query<{ id: number }>(
      "INSERT INTO cliente_contratante(nome,slug,ativo) VALUES ($1,$2,true) RETURNING id",
      [`${nomeTemporario}-b`, `${nomeTemporario}-b`],
    )
    clienteB = b.rows[0].id

    const pa = await db.query<{ id: number }>(
      "INSERT INTO dm_powerbi_painel(cliente_id,titulo,url) VALUES ($1,$2,$3) RETURNING id",
      [clienteA, "Painel temporário A", "https://app.powerbi.com/view?r=fixture-a"],
    )
    painelA = pa.rows[0].id
    const pb = await db.query<{ id: number }>(
      "INSERT INTO dm_powerbi_painel(cliente_id,titulo,url) VALUES ($1,$2,$3) RETURNING id",
      [clienteB, "Painel temporário B", "https://app.powerbi.com/view?r=fixture-b"],
    )
    painelB = pb.rows[0].id

    mocks.dev.mockReturnValue(false)
    mocks.query.mockImplementation((sql: string, values: unknown[] = []) => db!.query(sql, values))
  }, 30000)

  afterAll(async () => {
    if (!db) return
    try { await db.query("ROLLBACK") } finally { await db.end() }
  }, 30000)

  it("visualizador A recebe apenas cliente e painel A", async () => {
    autenticar({ email: "viewer-a@hub.test", isAdmin: false, isAnalista: false, visibleScreens: [`cliente-bi:${clienteA}`] })
    const response = await GET()
    expect(response.status).toBe(200)
    const data = await response.json() as { clientes: { id: number }[]; paineis: { clienteId: number; id: number }[] }
    expect(data.clientes.map(c => c.id)).toEqual([clienteA])
    expect(data.paineis.map(p => p.clienteId)).toEqual([clienteA])
    expect(data.paineis.map(p => p.id)).toEqual([painelA])
  })

  it("analista A não cria painel para cliente B", async () => {
    autenticar({ email: "analista-a@hub.test", isAdmin: false, isAnalista: true, visibleScreens: [`cliente-bi:${clienteA}`] })
    const response = await POST(request({
      clienteId: clienteB, titulo: "Tentativa fora do escopo",
      url: "https://app.powerbi.com/view?r=blocked",
    }, "POST"))
    expect(response.status).toBe(403)
  })

  it("impede mover painel A para cliente B e excluir painel B", async () => {
    autenticar({ email: "analista-a@hub.test", isAdmin: false, isAnalista: true, visibleScreens: [`cliente-bi:${clienteA}`] })
    const patch = await PATCH(request({
      id: painelA, clienteId: clienteB, titulo: "Painel A",
      url: "https://app.powerbi.com/view?r=fixture-a",
    }, "PATCH"))
    expect(patch.status).toBe(404)

    const deletion = await DELETE(new Request(`https://hub.test/api/powerbi?id=${painelB}`, { method: "DELETE" }))
    expect(deletion.status).toBe(404)

    const intactos = await db!.query<{ id: number; cliente_id: number }>(
      "SELECT id,cliente_id FROM dm_powerbi_painel WHERE id=ANY($1::integer[]) ORDER BY id",
      [[painelA, painelB]],
    )
    expect(intactos.rows).toEqual([
      { id: painelA, cliente_id: clienteA },
      { id: painelB, cliente_id: clienteB },
    ])
  })

  it("admin lista os dois clientes e seus painéis", async () => {
    autenticar({ email: "admin@hub.test", isAdmin: true, isAnalista: false, visibleScreens: [] })
    const response = await GET()
    expect(response.status).toBe(200)
    const data = await response.json() as { clientes: { id: number }[]; paineis: { clienteId: number }[] }
    expect(data.clientes.map(c => c.id)).toEqual(expect.arrayContaining([clienteA, clienteB]))
    expect(data.paineis.map(p => p.clienteId)).toEqual(expect.arrayContaining([clienteA, clienteB]))
  })

  it("salva a documentação, preserva em edição parcial e entrega só ao cliente autorizado", async () => {
    autenticar({ email: "analista-a@hub.test", isAdmin: false, isAnalista: true, visibleScreens: [`cliente-bi:${clienteA}`] })
    const documentacao = "Regras de cálculo\n\nConsiderar apenas notas recebidas no período."
    const dados = { clienteId: clienteA, titulo: "Relatório documentado", url: "https://app.powerbi.com/view?r=documentado" }
    expect((await POST(request({ ...dados, documentacao, icone: "wrench" }, "POST"))).status).toBe(201)
    const registro = await db!.query("SELECT id,documentacao,icone FROM dm_powerbi_painel WHERE cliente_id=$1 AND titulo=$2", [clienteA,dados.titulo])
    expect(registro.rows[0].icone).toBe("wrench")
    expect(registro.rows[0].documentacao).toBe(documentacao)
    const id = registro.rows[0].id as number
    expect((await PATCH(request({ ...dados, id, titulo: "Título revisado" }, "PATCH"))).status).toBe(200)
    autenticar({ email: "viewer-a@hub.test", isAdmin: false, isAnalista: false, visibleScreens: [`cliente-bi:${clienteA}`] })
    const autorizado = await (await GET()).json()
    expect(autorizado.paineis).toContainEqual(expect.objectContaining({ id, clienteId: clienteA, documentacao, icone: "wrench" }))
    expect(autorizado.clientes.find((c: { id: number }) => c.id === clienteA).relatorios).toContainEqual(expect.objectContaining({ id, icone: "wrench" }))
    autenticar({ email: "viewer-b@hub.test", isAdmin: false, isAnalista: false, visibleScreens: [`cliente-bi:${clienteB}`] })
    const outroCliente = await (await GET()).json()
    expect(JSON.stringify(outroCliente)).not.toContain(documentacao)
    expect(outroCliente.paineis.some((p: { id: number }) => p.id === id)).toBe(false)
    autenticar({ email: "analista-a@hub.test", isAdmin: false, isAnalista: true, visibleScreens: [`cliente-bi:${clienteA}`] })
    expect((await PATCH(request({ ...dados, id, documentacao: "" }, "PATCH"))).status).toBe(200)
    expect((await db!.query("SELECT documentacao FROM dm_powerbi_painel WHERE id=$1",[id])).rows[0].documentacao).toBe("")
  })
})
