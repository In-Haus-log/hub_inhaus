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
    clienteContratante: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
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
    mocks.prisma.authUser.upsert.mockImplementation(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => usuarioLocal({ ...create, ...update }))
    mocks.prisma.authUser.update.mockResolvedValue({})
    for (const model of [mocks.prisma.authUserCliente, mocks.prisma.authUserCr, mocks.prisma.authUserContratante]) {
      model.deleteMany.mockResolvedValue({ count: 0 })
      model.createMany.mockResolvedValue({ count: 1 })
    }
    mocks.prisma.$transaction.mockImplementation(async (operation: ((tx: typeof mocks.prisma) => Promise<unknown>) | unknown[]) =>
      Array.isArray(operation) ? Promise.all(operation) : (operation as (tx: typeof mocks.prisma) => Promise<unknown>)(mocks.prisma),
    )
    mocks.prisma.clienteContratante.findMany.mockResolvedValue([{ id: 42, nome: "Acme Brasil", slug: "acme-brasil-random" }])
    mocks.prisma.$queryRaw.mockResolvedValue([{ nome_grp_cliente: "ACME BRASIL" }, { nome_grp_cliente: "Outro" }])
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

    const upsert = mocks.prisma.authUser.upsert.mock.calls.at(-1)![0]
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

    expect(mocks.prisma.authUser.upsert.mock.calls.at(-1)![0]).toEqual(expect.objectContaining({
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
    expect(mocks.prisma.authUser.upsert.mock.calls.at(-1)![0].update).toMatchObject({
      hasAccess: false,
      isAdmin: false,
      isAnalista: false,
      visibleScreens: ["cliente-bi:17", "projecoes-analise"],
    })
  })

  it("deriva BI e grupo SRA dos contratantes e substitui vínculos CR/grupo antigos", async () => {
    mocks.prisma.authUser.upsert.mockImplementation(async ({ update }: { update: Record<string, unknown> }) =>
      usuarioLocal({ authUserId: "global-uuid-1", email: "pessoa@exemplo.com", ...update }),
    )

    const result = await atualizarAcessoLocal({
      email: "pessoa@exemplo.com", authUserId: "global-uuid-1", hasAccess: true,
      isAdmin: false, visibleScreens: ["controle-quadro", "cliente-bi:7"], contratantes: [42],
    })

    expect(mocks.prisma.authUser.upsert.mock.calls.at(-1)![0].update.visibleScreens).toEqual(["controle-quadro", "cliente-bi:42"])
    expect(mocks.prisma.authUserCliente.deleteMany).toHaveBeenCalledWith({ where: { authUserId: "global-uuid-1" } })
    expect(mocks.prisma.authUserCliente.createMany).toHaveBeenCalledWith({
      data: [{ authUserId: "global-uuid-1", nomeGrpCliente: "ACME BRASIL" }], skipDuplicates: true,
    })
    expect(mocks.prisma.authUserCr.deleteMany).toHaveBeenCalledWith({ where: { authUserId: "global-uuid-1" } })
    expect(mocks.prisma.authUserContratante.createMany).toHaveBeenCalledWith({
      data: [{ authUserId: "global-uuid-1", contratanteId: 42 }], skipDuplicates: true,
    })
    expect(result).toMatchObject({ visibleScreens: ["controle-quadro", "cliente-bi:42"], clientes: ["ACME BRASIL"], crs: [] })
  })

  it("concede todos os sistemas estáticos do contratante mesmo sem seleção individual", async () => {
    mocks.prisma.clienteContratante.findMany.mockResolvedValue([{ id: 42, nome: "Atlas Copco", slug: "slug-atlas" }])
    mocks.prisma.authUser.upsert.mockImplementation(async ({ update }: { update: Record<string, unknown> }) =>
      usuarioLocal({ authUserId: "global-uuid-1", email: "pessoa@exemplo.com", ...update }),
    )

    const result = await atualizarAcessoLocal({
      email: "pessoa@exemplo.com", authUserId: "global-uuid-1", hasAccess: true,
      isAdmin: false, visibleScreens: ["controle-quadro"], contratantes: [42],
    })

    expect(result.visibleScreens).toEqual(expect.arrayContaining([
      "controle-quadro", "cliente-bi:42", "desvios-painel", "desvios-acompanhamento", "desvios-formulario",
    ]))
  })

  it("falha fechado para contratante inexistente ou inativo", async () => {
    mocks.prisma.clienteContratante.findMany.mockResolvedValue([])
    await expect(atualizarAcessoLocal({
      email: "pessoa@exemplo.com", hasAccess: true, isAdmin: false, visibleScreens: [], contratantes: [404],
    })).rejects.toThrow("não existem ou estão inativos")
    expect(mocks.prisma.authUser.upsert).not.toHaveBeenCalled()
  })

  it("valida o contratante antes de criar uma identidade global", async () => {
    mocks.prisma.clienteContratante.findMany.mockResolvedValue([])
    await expect(criarUsuarioAdmin({
      name: "Pessoa Nova", email: "pessoa@exemplo.com", cpf: "12345678900", password: "senha-de-teste",
      hasAccess: true, isAdmin: false, isAnalista: false, visibleScreens: [], seguranca: false,
      classificacao: "CLIENTE", contratantes: [404],
    })).rejects.toThrow("não existem ou estão inativos")
    expect(mocks.createGlobalAuthUser).not.toHaveBeenCalled()
  })

  it("concede BI para cliente sem grupo SRA correspondente", async () => {
    mocks.prisma.$queryRaw.mockResolvedValue([])
    mocks.prisma.authUser.upsert.mockImplementation(async ({ update }: { update: Record<string, unknown> }) =>
      usuarioLocal({ authUserId: "global-uuid-1", email: "pessoa@exemplo.com", ...update }),
    )
    const result = await atualizarAcessoLocal({
      email: "pessoa@exemplo.com", authUserId: "global-uuid-1", hasAccess: true,
      isAdmin: false, visibleScreens: [], contratantes: [42],
    })
    expect(result.visibleScreens).toContain("cliente-bi:42")
    expect(result.clientes).toEqual([])
    expect(mocks.prisma.authUserCliente.createMany).not.toHaveBeenCalled()
  })

  it("seleção vazia remove chaves BI e todos os escopos antigos", async () => {
    mocks.prisma.authUser.upsert.mockImplementation(async ({ update }: { update: Record<string, unknown> }) =>
      usuarioLocal({ authUserId: "global-uuid-1", email: "pessoa@exemplo.com", ...update }),
    )
    const result = await atualizarAcessoLocal({
      email: "pessoa@exemplo.com", authUserId: "global-uuid-1", hasAccess: true,
      isAdmin: false, visibleScreens: ["cliente-bi:42", "desvios-painel", "controle-quadro"], contratantes: [],
    })
    expect(result.visibleScreens).toEqual(["controle-quadro"])
    expect(mocks.prisma.authUserCliente.deleteMany).toHaveBeenCalled()
    expect(mocks.prisma.authUserCr.deleteMany).toHaveBeenCalled()
    expect(mocks.prisma.authUserContratante.deleteMany).toHaveBeenCalled()
    expect(mocks.prisma.authUserCliente.createMany).not.toHaveBeenCalled()
    expect(mocks.prisma.authUserCr.createMany).not.toHaveBeenCalled()
    expect(mocks.prisma.authUserContratante.createMany).not.toHaveBeenCalled()
  })
})
