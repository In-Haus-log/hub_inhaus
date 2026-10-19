import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ dev: vi.fn(), sessao: vi.fn() }))
vi.mock("@/lib/dev-auth", () => ({ acessoLivreLiberado: mocks.dev }))
vi.mock("@/lib/auth-session", () => ({ getSessionReadOnly: mocks.sessao }))
import { escopoConformidadeAtual } from "./conformidade-legal-acesso"

describe("escopo específico da conformidade legal", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.dev.mockReturnValue(false) })

  it.each(["INTERNO", "CLIENTE"])("permite todos os CRs para sessão %s, sem vínculo ou papel admin", async (classificacao) => {
    mocks.sessao.mockResolvedValue({ status: "ok", sessao: { authorization: { isAdmin: false, classificacao } } })
    expect(await escopoConformidadeAtual()).toEqual({ tipo: "todos" })
  })

  it.each(["anonimo", "renovar"])("mantém sessão %s sem dados", async (status) => {
    mocks.sessao.mockResolvedValue({ status })
    expect(await escopoConformidadeAtual()).toEqual({ tipo: "lista", crs: [] })
  })
})
