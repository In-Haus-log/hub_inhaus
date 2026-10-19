// PRIMEIRA camada de defesa (defesa em profundidade) — checagem BARATA, só olha a
// PRESENÇA do cookie de sessão; não toca no banco nem valida o token. É apenas uma
// otimização de UX (evita renderizar a rota para quem obviamente não tem cookie).
// A validação REAL (token válido no global_auth + autorização local) acontece
// server-side no layout protegido (src/app/dashboards/layout.tsx via
// getSessionReadOnly) e nas rotas via requireSession/requireAdmin. NUNCA confie
// só neste middleware para proteger uma rota.
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { HEADER_PATHNAME } from "@/lib/http-headers"

const COOKIE_PREFIX = "inhaus"
const ACCESS_COOKIE = `${COOKIE_PREFIX}_access_token`
const REFRESH_COOKIE = `${COOKIE_PREFIX}_refresh_token`

/** Onde o usuário logado cai: o shell dos dashboards. */
export const ROTA_INICIAL = "/dashboards"

// Tudo que NÃO exige sessão. O resto do app é protegido por padrão — assim,
// adicionar um domínio novo não exige lembrar de atualizar esta lista.
// `/home` é a landing (hero) pública, preservada fora do fluxo principal.
// (v2: o preenchimento público de EPI por QR/CPF foi removido — quem registra a
// utilização é o líder, logado. Ver docs/versoes/…-v1 para o fluxo antigo.)
// `/t/<token>` é o preenchimento público de presença em treinamento (QR + CPF);
// `/api/t` é o endpoint que ele chama para confirmar (o colaborador não tem sessão).
const rotasPublicas = ["/login", "/home", "/t", "/api/t"]

/**
 * Acesso livre de desenvolvimento. A checagem é repetida aqui em vez de
 * importar `@/lib/dev-auth` porque o middleware roda no Edge Runtime, com
 * bundle próprio — manter esta linha independente evita arrastar o módulo
 * inteiro para o Edge. As duas travas são as mesmas.
 */
function acessoLivreLiberado(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.HUB_ACESSO_LIVRE === "1"
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Expõe o caminho atual aos server components (layout usa para a trava por tela).
  const headersComPath = new Headers(request.headers)
  headersComPath.set(HEADER_PATHNAME, pathname)
  const seguir = () => NextResponse.next({ request: { headers: headersComPath } })

  if (acessoLivreLiberado()) return seguir()

  const temSessao =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE)

  const ehPublica = rotasPublicas.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  )

  if (!ehPublica && !temSessao) {
    const url = new URL("/login", request.url)
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  // A presença de cookie não prova uma sessão válida. O login permanece acessível
  // para permitir nova autenticação quando os cookies estão expirados ou revogados.

  return seguir()
}

export const config = {
  // Ignora as rotas de autenticação, os assets do Next e os arquivos estáticos.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
}
