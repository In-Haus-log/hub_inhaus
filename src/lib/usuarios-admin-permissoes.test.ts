import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const prisma = {
    authUser: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    authUserCliente: { deleteMany: vi.fn(), createMany: vi.fn() },
    authUserCr: { deleteMany: vi.fn(), createMany: vi.fn() },
    authUserContratante: { deleteMany: vi.fn(), createMany: vi.fn() },
    epiMembro: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  }
  return { prisma, createGlobalAuthUser: vi.fn(), definirSegurancaCentral: vi.fn() }
})

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }))
vi.mock("@/lib/global-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/global-auth")>("@/lib/global-auth")
  return { ...actual, createGlobalAuthUser: mocks.createGlobalAuthUser }
})
vi.mock("@/lib/epi/config", () => ({
  definirSegurancaCentral: mocks.definirSegurancaCentral,
  listarAuthUserIdsSeguranca: vi.fn().mockResolvedValue(new Set()),
}))

import { atualizarAcessoLocal, criarUsuarioAdmin } from "./usuarios-admin"

type UsuarioLocal = {
  authUserId: string | null
  name: string | null
  email: string
  hasAccess: boolean
  isAdmin: boolean
  isAnalista: boolean
  visibleScreens: string[]
}

function usuarioLocal(data: Record<string, unknown>): UsuarioLocal {
  return {
    authUserId: (data.authUserId as string | null) ?? null,
    name: (data.name as string | null) ?? null,
    email: data.email as string,
    hasAccess: data.hasAccess as boolean,
    isAdmin: data.isAdmin as boolean,
    isAnalista: data.isAnalista as boolean,
    visibleScreens: data.visibleScreens as string[],
  }
}

describe("permissões ao criar e atualizar usuários do hub", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.createGlobalAuthUser.mockResolvedValue({
      id: "global-uuid-1",
      name: "Pessoa Nova",
      email: "pessoa@exemplo.com",
      cpf: "12345678900",
      type: "INTERNAL",
      isActive: true,
    })
    mocks.prisma.authUser.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => usuarioLocal(create))
    mocks.prisma.authUser.update.mockResolvedValue({})
    for (const model of [mocks.prisma.authUserCliente, mocks.prisma.authUserCr, mocks.prisma.authUserContratante]) {
      model.deleteMany.mockResolvedValue({ count: 0 })
      model.createMany.mockResolvedValue({ count: 1 })
    }
    mocks.prisma.$transaction.mockResolvedValue([])
  })

  it("cria acesso local com email normalizado, indicadores válidos e cliente BI, sem elevar o papel", async () => {
    const result = await criarUsuarioAdmin({
      name: "Pessoa Nova",
      email: "  Pessoa@Exemplo.COM ",
      cpf: "12345678900",
      password: "senha-de-teste",
      hasAccess: true,
      isAdmin: false,
      isAnalista: true,
      visibleScreens: ["cliente-bi:42", "projecoes-analise", "controle-quadro", "tela-inventada"],
      seguranca: false,
      classificacao: "CLIENTE",
      crs: ["01234"],
    })

    const upsert = mocks.prisma.authUser.upsert.mock.calls[0][0]
    expect(upsert.where).toEqual({ email: "pessoa@exemplo.com" })
    expect(upsert.create).toMatchObject({
      email: "pessoa@exemplo.com",
      hasAccess: true,
      isAdmin: false,
      isAnalista: true,
      visibleScreens: ["cliente-bi:42", "projecoes-analise", "controle-quadro"],
    })
    expect(result).toMatchObject({
      email: "pessoa@exemplo.com",
      hasAccess: true,
      isAdmin: false,
      isAnalista: true,
      visibleScreens: ["cliente-bi:42", "projecoes-analise", "controle-quadro"],
      classificacao: "CLIENTE",
    })
    expect(mocks.prisma.authUser.update).toHaveBeenCalledWith({
      where: { email: "pessoa@exemplo.com" },
      data: { classificacao: "CLIENTE" },
    })
    expect(mocks.prisma.authUserCr.createMany).toHaveBeenCalledWith({
      data: [{ authUserId: "global-uuid-1", cr: "01234" }], skipDuplicates: true,
    })
  })

  it("atualiza concessão local e mantém somente as telas válidas recebidas", async () => {
    mocks.prisma.authUser.upsert.mockImplementation(async ({ update }: { update: Record<string, unknown> }) =>
      usuarioLocal({
        authUserId: "global-uuid-1",
        name: "Pessoa Nova",
        email: "pessoa@exemplo.com",
        ...update,
      }),
    )

    const result = await atualizarAcessoLocal({
      email: " Pessoa@Exemplo.COM ",
      authUserId: "global-uuid-1",
      hasAccess: true,
      isAdmin: false,
      isAnalista: true,
      visibleScreens: ["cliente-bi:17", "absenteismo", "qualquer-coisa"],
    })

    expect(mocks.prisma.authUser.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: "pessoa@exemplo.com" },
      update: expect.objectContaining({ hasAccess: true, isAdmin: false, isAnalista: true }),
      create: expect.objectContaining({ visibleScreens: ["cliente-bi:17", "absenteismo"] }),
    }))
    expect(result).toMatchObject({
      hasAccess: true,
      isAdmin: false,
      isAnalista: true,
      visibleScreens: ["cliente-bi:17", "absenteismo"],
    })
  })

  it("revoga acesso local sem conceder admin nem apagar a seleção válida de telas", async () => {
    mocks.prisma.authUser.upsert.mockImplementation(async ({ update }: { update: Record<string, unknown> }) =>
      usuarioLocal({
        authUserId: "global-uuid-1",
        name: "Pessoa Nova",
        email: "pessoa@exemplo.com",
        ...update,
      }),
    )

    const result = await atualizarAcessoLocal({
      email: "pessoa@exemplo.com",
      authUserId: "global-uuid-1",
      hasAccess: false,
      isAdmin: false,
      isAnalista: false,
      visibleScreens: ["cliente-bi:17", "projecoes-analise"],
    })

    expect(result).toMatchObject({
      hasAccess: false,
      isAdmin: false,
      isAnalista: false,
      visibleScreens: ["cliente-bi:17", "projecoes-analise"],
    })
    expect(mocks.prisma.authUser.upsert.mock.calls[0][0].update).toMatchObject({
      hasAccess: false,
      isAdmin: false,
      isAnalista: false,
      visibleScreens: ["cliente-bi:17", "projecoes-analise"],
    })
  })
})
