// Camada de SESSÃO do hub sobre o global_auth.
//
// Identidade (quem é / senha / ativo global) vem do global_auth. AUTORIZAÇÃO
// (quem entra + se é admin) é regra DESTE projeto e vive em auth_users, resolvida
// em `resolveAuthorization`. Tokens só em cookies httpOnly.

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import {
  GlobalAuthError,
  getGlobalAuthUser,
  normalizeEmail,
  refreshGlobalAuthSession,
  type GlobalAuthTokens,
  type GlobalAuthUser,
} from "@/lib/global-auth"
import { prisma } from "@/lib/prisma"
import { CHAVES_DE_TELA } from "@/lib/domains"
import { expandirTelasAutorizadasContratantes } from "@/lib/clientes-autorizacao"
import { idsClientesBi } from "@/lib/powerbi-permissoes"

// Nomes prefixados com o slug do projeto para não colidir com outros apps no domínio.
const COOKIE_PREFIX = "inhaus"
const ACCESS_COOKIE = `${COOKIE_PREFIX}_access_token`
const REFRESH_COOKIE = `${COOKIE_PREFIX}_refresh_token`

const ACCESS_MAX_AGE = Number(process.env.AUTH_ACCESS_COOKIE_MAX_AGE_SECONDS) || 43200 // 12h
const REFRESH_MAX_AGE = Number(process.env.AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS) || 7776000 // 90d

// Admin(s) "bootstrap": sempre entram como admin, mesmo antes de existir linha no
// banco (resolve o ovo-e-galinha do primeiro acesso). Pode estender via env.
const BOOTSTRAP_ADMINS = (
  process.env.BOOTSTRAP_ADMIN_EMAILS ?? "fernando.c.souza@gpssa.com.br"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

// ---------------------------------------------------------------------------
// FRONTEIRA identidade × autorização (regra DO PROJETO)
// ---------------------------------------------------------------------------

export type Authorization = {
  usuarioId: number
  email: string
  nome: string | null
  isAdmin: boolean
  isAnalista?: boolean
  hasAccess: boolean
  // Classificação local (INTERNO | CLIENTE). Não restringe permissões; alimenta o
  // escopo de dados (CLIENTE nunca vê tudo).
  classificacao: string
  // Telas locais liberadas para este usuário. Admin sempre recebe TODAS (CHAVES_DE_TELA),
  // independente do que está salvo no banco — regra de autorização deste projeto.
  visibleScreens: string[]
}

// Resolve o acesso lendo auth_users pelo e-mail/UUID do global_auth.
//  - admin bootstrap: garante linha admin + acesso (e entra mesmo sem banco);
//  - demais: só entram se houver linha com hasAccess = true (admin concede);
//  - espelha o authUserId no 1º login (liga identidade ↔ acesso local).
// Nenhuma escrita no global_auth aqui — só leitura de identidade + acesso local.
async function resolveAuthorization(user: GlobalAuthUser): Promise<Authorization | null> {
  const email = normalizeEmail(user.email)
  const ehBootstrap = BOOTSTRAP_ADMINS.includes(email)

  try {
    let registro = await prisma.authUser.findFirst({
      where: { OR: [{ authUserId: user.id }, { email }] },
    })

    if (ehBootstrap) {
      registro = await prisma.authUser.upsert({
        where: { email },
        update: {
          authUserId: user.id,
          name: registro?.name ?? user.name ?? null,
          isAdmin: true,
          hasAccess: true,
          lastLoginAt: new Date(),
        },
        create: {
          email,
          authUserId: user.id,
          name: user.name ?? null,
          isAdmin: true,
          hasAccess: true,
          lastLoginAt: new Date(),
        },
      })
    } else {
      if (!registro || !registro.hasAccess) return null
      registro = await prisma.authUser.update({
        where: { id: registro.id },
        data: {
          authUserId: user.id,
          name: registro.name ?? user.name ?? null,
          lastLoginAt: new Date(),
        },
      })
    }

    const vinculos = registro.isAdmin ? [] : await prisma.authUserContratante.findMany({
      where: { authUserId: user.id },
      select: { contratanteId: true },
    })
    const telas = registro.isAdmin ? CHAVES_DE_TELA : await expandirTelasAutorizadasContratantes(
      registro.visibleScreens ?? [],
      [...vinculos.map(v => v.contratanteId), ...idsClientesBi(registro.visibleScreens ?? [])],
    )

    return {
      usuarioId: registro.id,
      email: registro.email,
      nome: registro.name ?? user.name ?? null,
      isAdmin: registro.isAdmin,
      isAnalista: registro.isAnalista,
      hasAccess: registro.hasAccess,
      classificacao: registro.classificacao ?? "INTERNO",
      // Admin enxerga TODAS as telas, sem restrição; demais usam o que foi concedido.
      visibleScreens: telas,
    }
  } catch {
    // Banco indisponível: o admin bootstrap ainda autentica (sem id persistido).
    if (ehBootstrap) {
      return {
        usuarioId: 0,
        email,
        nome: user.name ?? null,
        isAdmin: true,
        hasAccess: true,
        classificacao: "INTERNO",
        visibleScreens: CHAVES_DE_TELA,
      }
    }
    return null
  }
}

export type Sessao = {
  user: GlobalAuthUser
  authorization: Authorization
}

// ---- Cookies httpOnly ----

function cookieBase() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  }
}

export function setAuthCookies(tokens: GlobalAuthTokens) {
  const store = cookies()
  store.set(ACCESS_COOKIE, tokens.accessToken, { ...cookieBase(), maxAge: ACCESS_MAX_AGE })
  store.set(REFRESH_COOKIE, tokens.refreshToken, { ...cookieBase(), maxAge: REFRESH_MAX_AGE })
}

export function clearAuthCookies() {
  const store = cookies()
  store.set(ACCESS_COOKIE, "", { ...cookieBase(), maxAge: 0 })
  store.set(REFRESH_COOKIE, "", { ...cookieBase(), maxAge: 0 })
}

export function getRefreshTokenFromCookies() {
  return cookies().get(REFRESH_COOKIE)?.value ?? null
}

// Access token corrente. Seguro de ler após requireAdmin(), que já revalidou a
// sessão. Usado para chamadas Bearer ao global_auth (ex.: GET /users).
export function getAccessTokenFromCookies() {
  return cookies().get(ACCESS_COOKIE)?.value ?? null
}

// ---- Sessão atual (refresh rotativo + memoização curta) ----

type SessaoCache = { sessao: Sessao; expiraEm: number }
const SESSION_TTL_MS = 60_000
const sessaoCache = new Map<string, SessaoCache>()
export function invalidarAutorizacaoLocal(email: string) {
  for (const [token,entrada] of sessaoCache) {
    if (entrada.sessao.user.email.toLowerCase() === email.toLowerCase()) sessaoCache.delete(token)
  }
}

function lerCache(accessToken: string): Sessao | null {
  const hit = sessaoCache.get(accessToken)
  if (hit && hit.expiraEm > Date.now()) return hit.sessao
  if (hit) sessaoCache.delete(accessToken)
  return null
}

function gravarCache(accessToken: string, sessao: Sessao) {
  sessaoCache.set(accessToken, { sessao, expiraEm: Date.now() + SESSION_TTL_MS })
}

async function resolverSessao(user: GlobalAuthUser): Promise<Sessao | null> {
  if (!user.isActive) return null // inativo no global_auth nunca entra
  const authorization = await resolveAuthorization(user)
  if (!authorization) return null // regra de acesso do projeto negou
  return { user, authorization }
}

// Constrói a sessão a partir de um usuário já autenticado (login/2fa após cookies).
export async function montarSessaoDoUsuario(user: GlobalAuthUser): Promise<Sessao | null> {
  return resolverSessao(user)
}

// Lê os cookies, valida o access em /auth/me; se expirado, renova via refresh
// (ROTACIONANDO os cookies). Memoiza ~60s por accessToken.
export async function getCurrentSession(): Promise<Sessao | null> {
  const store = cookies()
  const accessToken = store.get(ACCESS_COOKIE)?.value ?? null
  const refreshToken = store.get(REFRESH_COOKIE)?.value ?? null

  if (!accessToken && !refreshToken) return null

  if (accessToken) {
    const cacheado = lerCache(accessToken)
    if (cacheado) return cacheado

    try {
      const user = await getGlobalAuthUser(accessToken)
      const sessao = await resolverSessao(user)
      if (sessao) gravarCache(accessToken, sessao)
      return sessao
    } catch (error) {
      const expirado = error instanceof GlobalAuthError && (error.status === 401 || error.status === 403)
      if (!expirado) return null // env ausente/erro inesperado: trata como sem sessão
      // cai para o refresh abaixo
    }
  }

  if (!refreshToken) {
    clearAuthCookies()
    return null
  }

  try {
    const tokens = await refreshGlobalAuthSession(refreshToken)
    setAuthCookies(tokens) // PERSISTE o novo refreshToken rotacionado
    const user = await getGlobalAuthUser(tokens.accessToken)
    const sessao = await resolverSessao(user)
    if (sessao) gravarCache(tokens.accessToken, sessao)
    else clearAuthCookies()
    return sessao
  } catch {
    clearAuthCookies()
    return null
  }
}

// Variante SOMENTE LEITURA para Server Components (layouts/pages), que NÃO podem
// gravar cookies no Next 14. Valida o access token em /auth/me sem rotacionar nem
// limpar cookies. Se o access estiver expirado mas houver refresh token, quem
// rotaciona é a rota /api/auth/refresh (Route Handler) — o layout redireciona pra lá.
export type SessaoReadOnly =
  | { status: "ok"; sessao: Sessao }
  | { status: "renovar" } // access inválido, mas há refresh — rotacionar via route handler
  | { status: "anonimo" }

export async function getSessionReadOnly(): Promise<SessaoReadOnly> {
  const store = cookies()
  const accessToken = store.get(ACCESS_COOKIE)?.value ?? null
  const refreshToken = store.get(REFRESH_COOKIE)?.value ?? null

  if (accessToken) {
    const cacheado = lerCache(accessToken)
    if (cacheado) return { status: "ok", sessao: cacheado }
    try {
      const user = await getGlobalAuthUser(accessToken)
      const sessao = await resolverSessao(user)
      if (sessao) {
        gravarCache(accessToken, sessao)
        return { status: "ok", sessao }
      }
      return { status: "anonimo" } // autenticado mas sem acesso ao projeto
    } catch {
      // access expirado/inválido — sem gravar nada; decide pelo refresh abaixo
    }
  }

  return refreshToken ? { status: "renovar" } : { status: "anonimo" }
}

// ---- Guards ----
// Inicie TODA rota protegida com requireSession(); admin com requireAdmin().

type GuardOk = { ok: true; sessao: Sessao }
type GuardFail = { ok: false; response: NextResponse }

export async function requireSession(): Promise<GuardOk | GuardFail> {
  const sessao = await getCurrentSession()
  if (!sessao) return { ok: false, response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  return { ok: true, sessao }
}

export async function requireAdmin(): Promise<GuardOk | GuardFail> {
  const guard = await requireSession()
  if (!guard.ok) return guard
  if (!guard.sessao.authorization.isAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 }),
    }
  }
  return guard
}
