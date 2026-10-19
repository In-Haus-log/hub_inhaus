// Gestão de usuários do hub (tela de administração).
//
// FRONTEIRA: identidade × autorização.
//  - Identidade (nome/e-mail/CPF/senha/ativo global) vive no global_auth. Aqui só
//    LISTAMOS (Bearer do admin) e CRIAMOS (X-Api-Key) — nunca editamos/excluímos a
//    identidade global a partir do projeto.
//  - Autorização (quem tem acesso a ESTE hub, se é admin, e quais telas vê) é regra
//    do projeto e vive em `auth_users` (banco local). É o que o admin concede aqui.
//
// Módulo server-only.

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  listGlobalAuthUsers,
  createGlobalAuthUser,
  GlobalAuthError,
  normalizeEmail,
  type GlobalAuthUser,
} from "@/lib/global-auth"
import { sanitizarTelas } from "@/lib/domains"
import { definirSegurancaCentral, listarAuthUserIdsSeguranca } from "@/lib/epi/config"

export type UsuarioAdmin = {
  authUserId: string | null
  name: string | null
  email: string
  cpf: string | null
  type: string | null
  /** Ativo no global_auth (identidade). */
  isActive: boolean
  // --- acesso LOCAL deste projeto (autorização) ---
  hasAccess: boolean
  isAdmin: boolean
  isAnalista: boolean
  visibleScreens: string[]
  /** Papel Segurança (SST central) — configura o módulo de EPI. */
  ehSeguranca: boolean
  /** Classificação local do hub (INTERNO | CLIENTE). Não restringe permissões. */
  classificacao: string
  /** Escopo de dados: grupos de cliente (dm_cr.nome_grp_cliente) vinculados. */
  clientes: string[]
  /** Escopo de dados: CRs avulsos (código 5 chars) vinculados. */
  crs: string[]
  /** Escopo multi-tenant: clientes contratantes vinculados (ids). */
  contratantes: number[]
}

/** Mescla as identidades do global_auth com o acesso local (auth_users). */
export async function listarUsuariosAdmin(accessToken: string): Promise<UsuarioAdmin[]> {
  const [globais, locais, segurancaIds, vClientes, vCrs, vContratantes] = await Promise.all([
    listGlobalAuthUsers(accessToken),
    prisma.authUser.findMany(),
    listarAuthUserIdsSeguranca(),
    prisma.authUserCliente.findMany({ select: { authUserId: true, nomeGrpCliente: true } }),
    prisma.authUserCr.findMany({ select: { authUserId: true, cr: true } }),
    prisma.authUserContratante.findMany({ select: { authUserId: true, contratanteId: true } }),
  ])
  const porEmail = new Map(locais.map((l) => [l.email.toLowerCase(), l]))
  const porUuid = new Map(
    locais.filter((l) => l.authUserId).map((l) => [l.authUserId as string, l]),
  )
  const clientesPorUuid = new Map<string, string[]>()
  for (const v of vClientes) {
    const arr = clientesPorUuid.get(v.authUserId) ?? []
    arr.push(v.nomeGrpCliente)
    clientesPorUuid.set(v.authUserId, arr)
  }
  const crsPorUuid = new Map<string, string[]>()
  for (const v of vCrs) {
    const arr = crsPorUuid.get(v.authUserId) ?? []
    arr.push(v.cr)
    crsPorUuid.set(v.authUserId, arr)
  }
  const contratantesPorUuid = new Map<string, number[]>()
  for (const v of vContratantes) {
    const arr = contratantesPorUuid.get(v.authUserId) ?? []
    arr.push(v.contratanteId)
    contratantesPorUuid.set(v.authUserId, arr)
  }
  return globais
    .map((g): UsuarioAdmin => {
      const local = porUuid.get(g.id) ?? porEmail.get(normalizeEmail(g.email))
      return {
        authUserId: g.id,
        name: g.name ?? local?.name ?? null,
        email: g.email,
        cpf: g.cpf ?? null,
        type: (g.type as string) ?? null,
        isActive: g.isActive,
        hasAccess: local?.hasAccess ?? false,
        isAdmin: local?.isAdmin ?? false,
        isAnalista: local?.isAnalista ?? false,
        visibleScreens: local?.visibleScreens ?? [],
        ehSeguranca: segurancaIds.has(g.id),
        classificacao: local?.classificacao ?? "INTERNO",
        clientes: clientesPorUuid.get(g.id) ?? [],
        crs: crsPorUuid.get(g.id) ?? [],
        contratantes: contratantesPorUuid.get(g.id) ?? [],
      }
    })
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, "pt-BR"))
}

/**
 * Cria a IDENTIDADE no global_auth (ou reusa, se o e-mail já existir lá) e espelha
 * o ACESSO local. Criar identidade não concede acesso — o acesso é o registro local.
 */
export async function criarUsuarioAdmin(input: {
  name: string
  email: string
  cpf: string
  password: string
  isAdmin: boolean
  isAnalista: boolean
  hasAccess: boolean
  visibleScreens: string[]
  seguranca: boolean
  classificacao: string
  clientes?: string[]
  crs?: string[]
  contratantes?: number[]
}): Promise<UsuarioAdmin> {
  const email = normalizeEmail(input.email)
  let identidade: GlobalAuthUser | null = null
  try {
    identidade = await createGlobalAuthUser({
      name: input.name,
      email,
      cpf: input.cpf,
      password: input.password,
      type: "INTERNAL",
    })
  } catch (e) {
    // E-mail já existe no global_auth (conflito): não recria a identidade, apenas
    // concede o acesso local. Outros erros sobem.
    if (e instanceof GlobalAuthError && (e.status === 409 || e.status === 422)) {
      identidade = null
    } else {
      throw e
    }
  }

  const telas = sanitizarTelas(input.visibleScreens)
  const local = await prisma.authUser.upsert({
    where: { email },
    update: {
      authUserId: identidade?.id ?? undefined,
      name: input.name,
      isAdmin: input.isAdmin,
      isAnalista: input.isAnalista,
      hasAccess: input.hasAccess,
      visibleScreens: telas,
    },
    create: {
      email,
      authUserId: identidade?.id ?? null,
      name: input.name,
      isAdmin: input.isAdmin,
      isAnalista: input.isAnalista,
      hasAccess: input.hasAccess,
      visibleScreens: telas,
    },
  })

  // Papel Segurança precisa do UUID do global_auth (chave de epi_membro).
  const uuid = local.authUserId ?? identidade?.id ?? null
  const ehSeg = Boolean(uuid && input.seguranca)
  if (uuid && input.seguranca) await definirSegurancaCentral(uuid, true)
  await salvarClassificacaoEVinculos(
    email,
    uuid,
    input.classificacao,
    input.clientes,
    input.crs,
    input.contratantes,
  )

  return {
    authUserId: uuid,
    name: local.name,
    email: local.email,
    cpf: identidade?.cpf ?? input.cpf,
    type: (identidade?.type as string) ?? "INTERNAL",
    isActive: identidade?.isActive ?? true,
    hasAccess: local.hasAccess,
    isAdmin: local.isAdmin,
    isAnalista: local.isAnalista,
    visibleScreens: local.visibleScreens,
    ehSeguranca: ehSeg,
    classificacao: input.classificacao,
    clientes: input.clientes ?? [],
    crs: input.crs ?? [],
    contratantes: input.contratantes ?? [],
  }
}

/**
 * Atualiza SÓ o acesso LOCAL (autorização do projeto): concede/revoga acesso ao
 * hub, define admin e escolhe as telas visíveis. NUNCA toca na identidade global.
 */
export async function atualizarAcessoLocal(input: {
  email: string
  authUserId?: string | null
  name?: string | null
  hasAccess: boolean
  isAdmin: boolean
  isAnalista?: boolean
  visibleScreens: string[]
  seguranca?: boolean
  classificacao?: string
  clientes?: string[]
  crs?: string[]
  contratantes?: number[]
}): Promise<UsuarioAdmin> {
  const email = normalizeEmail(input.email)
  const telas = sanitizarTelas(input.visibleScreens)
  const local = await prisma.authUser.upsert({
    where: { email },
    update: {
      hasAccess: input.hasAccess,
      isAdmin: input.isAdmin,
      isAnalista: input.isAnalista ?? undefined,
      visibleScreens: telas,
      authUserId: input.authUserId ?? undefined,
      name: input.name ?? undefined,
    },
    create: {
      email,
      authUserId: input.authUserId ?? null,
      name: input.name ?? null,
      hasAccess: input.hasAccess,
      isAdmin: input.isAdmin,
      isAnalista: input.isAnalista ?? false,
      visibleScreens: telas,
    },
  })

  // Papel Segurança (só dá para amarrar se o usuário tem UUID do global_auth).
  const uuid = local.authUserId ?? input.authUserId ?? null
  let ehSeg = false
  if (uuid && input.seguranca !== undefined) {
    await definirSegurancaCentral(uuid, input.seguranca)
    ehSeg = input.seguranca
  }

  const classe = input.classificacao ?? "INTERNO"
  await salvarClassificacaoEVinculos(
    email,
    uuid,
    classe,
    input.clientes,
    input.crs,
    input.contratantes,
  )

  return {
    authUserId: uuid,
    name: local.name,
    email: local.email,
    cpf: null,
    type: null,
    isActive: true,
    hasAccess: local.hasAccess,
    isAdmin: local.isAdmin,
    isAnalista: local.isAnalista,
    visibleScreens: local.visibleScreens,
    ehSeguranca: ehSeg,
    classificacao: classe,
    clientes: input.clientes ?? [],
    crs: input.crs ?? [],
    contratantes: input.contratantes ?? [],
  }
}

/**
 * Grava a classificação e, quando informados, SUBSTITUI os vínculos de escopo
 * (cliente/CR/contratante) do usuário, em transação. Chave = UUID do global_auth.
 * Sem uuid, não há como amarrar escopo. Um vínculo `undefined` fica INTOCADO —
 * evita apagar escopo existente quando o formulário não envia mais esses campos.
 */
async function salvarClassificacaoEVinculos(
  email: string,
  uuid: string | null,
  classificacao: string,
  clientes: string[] | undefined,
  crs: string[] | undefined,
  contratantes: number[] | undefined,
): Promise<void> {
  await prisma.authUser.update({ where: { email }, data: { classificacao } })
  if (!uuid) return

  const ops: Prisma.PrismaPromise<unknown>[] = []

  if (clientes !== undefined) {
    ops.push(prisma.authUserCliente.deleteMany({ where: { authUserId: uuid } }))
    if (clientes.length) {
      ops.push(
        prisma.authUserCliente.createMany({
          data: clientes.map((nomeGrpCliente) => ({ authUserId: uuid, nomeGrpCliente })),
          skipDuplicates: true,
        }),
      )
    }
  }

  if (crs !== undefined) {
    ops.push(prisma.authUserCr.deleteMany({ where: { authUserId: uuid } }))
    if (crs.length) {
      ops.push(
        prisma.authUserCr.createMany({
          data: crs.map((cr) => ({ authUserId: uuid, cr })),
          skipDuplicates: true,
        }),
      )
    }
  }

  if (contratantes !== undefined) {
    ops.push(prisma.authUserContratante.deleteMany({ where: { authUserId: uuid } }))
    if (contratantes.length) {
      ops.push(
        prisma.authUserContratante.createMany({
          data: contratantes.map((contratanteId) => ({ authUserId: uuid, contratanteId })),
          skipDuplicates: true,
        }),
      )
    }
  }

  if (ops.length) await prisma.$transaction(ops)
}
