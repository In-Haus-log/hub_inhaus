import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"
const mocks = vi.hoisted(() => ({ guarda: vi.fn(), importar: vi.fn() }))
vi.mock("@/lib/admin-guard", () => ({ guardAdmin: mocks.guarda }))
vi.mock("@/lib/conformidade-legal-importacao", () => ({ importarConformidadeLegal: mocks.importar, LIMITE_ARQUIVO_CONFORMIDADE: 4 * 1024 * 1024, ErroArquivoImportacao: class extends Error {} }))
import { POST } from "@/app/api/conformidade-legal/importar/route"
describe("autorização da importação de Excel", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("EPI_CPF_SECRET", "segredo-teste"); mocks.guarda.mockResolvedValue({ ok: true }) })
  afterEach(() => vi.unstubAllEnvs())
  it("recusa origem externa antes de ler o arquivo", async () => {
    const resposta = await POST(new NextRequest("https://hub.test/api/conformidade-legal/importar", { method: "POST", headers: { host: "hub.test", origin: "https://externo.test" } }))
    expect(resposta.status).toBe(403); expect(mocks.importar).not.toHaveBeenCalled()
  })
  it("recusa usuário sem permissão administrativa", async () => {
    mocks.guarda.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) })
    const resposta = await POST(new NextRequest("https://hub.test/api/conformidade-legal/importar", { method: "POST", headers: { host: "hub.test", origin: "https://hub.test" } }))
    expect(resposta.status).toBe(403); expect(mocks.importar).not.toHaveBeenCalled()
  })
  it("recusa upload acima do limite sem consultar o banco", async () => {
    const resposta = await POST(new NextRequest("https://hub.test/api/conformidade-legal/importar", { method: "POST", headers: { host: "hub.test", origin: "https://hub.test", "content-length": "5000000" } }))
    expect(resposta.status).toBe(413); expect(mocks.importar).not.toHaveBeenCalled()
  })
})
