import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authUser: { findFirst: vi.fn(), update: vi.fn() },
  authUserContratante: { findMany: vi.fn() },
  clienteContratante: { findMany: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ prisma: mocks }))
vi.mock("next/headers", () => ({ cookies: vi.fn() }))

import { montarSessaoDoUsuario } from "./auth-session"

describe("sessão com acesso herdado do cliente", () => {
  const usuario = { id: "usuario-cliente", email: "cliente@exemplo.test", name: "Pessoa cliente", isActive: true }
  beforeEach(() => {
    vi.resetAllMocks()
    const registro = {
      id: 90, email: usuario.email, name: usuario.name, isAdmin: false, isAnalista: false,
      hasAccess: true, classificacao: "CLIENTE", visibleScreens: ["cliente-bi:6"],
    }
    mocks.authUser.findFirst.mockResolvedValue(registro)
    mocks.authUser.update.mockResolvedValue(registro)
    mocks.authUserContratante.findMany.mockResolvedValue([])
    mocks.clienteContratante.findMany.mockResolvedValue([{ id: 6, nome: "Enjoei", slug: "enjoei" }])
  })

  it("uma concessão antiga de BI libera todos os sistemas do mesmo cliente ao fazer login", async () => {
    const sessao = await montarSessaoDoUsuario(usuario)
    expect(sessao?.authorization.visibleScreens).toEqual(expect.arrayContaining([
      "cliente-bi:6", "enjoei-turnover", "enjoei-absenteismo",
    ]))
    expect(sessao?.authorization.visibleScreens).not.toContain("desvios-painel")
    expect(sessao?.authorization.isAdmin).toBe(false)
  })

  it("o vínculo de cliente basta mesmo sem marcar nenhuma tela", async () => {
    const registro = { ...(await mocks.authUser.findFirst()), visibleScreens: [] }
    mocks.authUser.findFirst.mockResolvedValue(registro)
    mocks.authUser.update.mockResolvedValue(registro)
    mocks.authUserContratante.findMany.mockResolvedValue([{ contratanteId: 6 }])
    const sessao = await montarSessaoDoUsuario(usuario)
    expect(sessao?.authorization.visibleScreens).toEqual(expect.arrayContaining([
      "cliente-bi:6", "enjoei-turnover", "enjoei-absenteismo",
    ]))
  })

  it("sem concessão nem vínculo não libera outro cliente", async () => {
    const registro = { ...(await mocks.authUser.findFirst()), visibleScreens: [] }
    mocks.authUser.findFirst.mockResolvedValue(registro)
    mocks.authUser.update.mockResolvedValue(registro)
    const sessao = await montarSessaoDoUsuario(usuario)
    expect(sessao?.authorization.visibleScreens).toEqual([])
    expect(mocks.clienteContratante.findMany).not.toHaveBeenCalled()
  })
})
