import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionReadOnly } from "@/lib/auth-session"
import { acessoLivreLiberado, USUARIO_DEV } from "@/lib/dev-auth"
import { CHAVES_DE_TELA } from "@/lib/domains"
import { HEADER_PATHNAME } from "@/lib/http-headers"
import { resolverAcessoEpi, podeConfigurar } from "@/lib/epi/papeis"
import { escopoDoUsuario, podeVerValidacoes } from "@/lib/epi/escopo"
import { listarClientesBi } from "@/lib/powerbi-acesso"
import { idsClientesBi, type ClienteBi } from "@/lib/powerbi-permissoes"
import { preenchedorExclusivo } from "@/lib/dashboard-perfil"

/**
 * Papéis do usuário no shell do dashboard, resolvidos UMA vez e reaproveitados
 * pelo layout, pela Home (redirecionamento por perfil) e pela lista de Checklists.
 *
 *  - `epiConfig`  = admin/Segurança: configura tudo (Configurar/Checklists/Líderes).
 *  - `epiValida`  = admin/Segurança/líder: pode preencher a Utilização de EPIs.
 *  - `soPreenche` = líder puro (valida, mas não configura nem é admin). Este é o
 *    usuário "de chão de fábrica": no celular ele NÃO vê a sidebar e cai direto na
 *    lista de checklists ao logar.
 */
export type PapeisDashboard = {
  nome: string | null
  email: string | null
  isAdmin: boolean
  isAnalista?: boolean
  clientesBi?: ClienteBi[]
  epiConfig: boolean
  epiValida: boolean
  soPreenche: boolean
  /** Telas concedidas ao usuário (chaves de domains.ts). Admin/dev = todas. */
  visibleScreens: string[]
  /** Classificação local: 'INTERNO' | 'CLIENTE'. Dita o portal enxuto do cliente. */
  classificacao: string
}

/**
 * Monta o destino do refresh de sessão PRESERVANDO a página que o usuário pediu.
 * `pathname` vem do header publicado pelo middleware (HEADER_PATHNAME); quando ausente,
 * cai no fallback. Regressão que isto blinda: o refresh jogava todo mundo para a Visão
 * Geral porque o caminho pedido se perdia. Puro de propósito — é o que os testes cobrem.
 */
export function destinoRefresh(pathname: string | null, fallback = "/dashboards"): string {
  const path = pathname && pathname.startsWith("/") ? pathname : fallback
  return `/api/auth/refresh?next=${encodeURIComponent(path)}`
}

export async function resolverPapeisDashboard(next = "/dashboards"): Promise<PapeisDashboard> {
  // Acesso livre (dev): admin fictício enxerga tudo — nunca é "só preenche".
  if (acessoLivreLiberado()) {
    return {
      nome: USUARIO_DEV.nome,
      email: null,
      isAdmin: USUARIO_DEV.isAdmin,
      epiConfig: true,
      epiValida: true,
      soPreenche: false,
      visibleScreens: CHAVES_DE_TELA,
      classificacao: "INTERNO",
      clientesBi: await listarClientesBi({ isAdmin: true, ids: [] }).catch(() => []),
    }
  }

  const resultado = await getSessionReadOnly()
  if (resultado.status === "anonimo") redirect("/login")
  if (resultado.status === "renovar") {
    // Preserva a página que o usuário pediu (o middleware publica em HEADER_PATHNAME);
    // sem isso, o refresh de sessão jogava todo mundo de volta para a Visão Geral.
    redirect(destinoRefresh(headers().get(HEADER_PATHNAME), next))
  }

  const { sessao } = resultado
  const acessoEpi = await resolverAcessoEpi({
    authUserId: sessao.user.id,
    isAdmin: sessao.authorization.isAdmin,
  })
  const escopoEpi = await escopoDoUsuario(acessoEpi, sessao.user.id)
  const isAdmin = sessao.authorization.isAdmin
  const epiConfig = podeConfigurar(acessoEpi)
  const epiValida = podeVerValidacoes(escopoEpi)

  return {
    nome: sessao.authorization.nome,
    email: sessao.user.email,
    isAdmin,
    isAnalista: sessao.authorization.isAnalista ?? false,
    clientesBi: await listarClientesBi({ isAdmin, ids: idsClientesBi(sessao.authorization.visibleScreens) }).catch(() => []),
    epiConfig,
    epiValida,
    soPreenche: preenchedorExclusivo({ epiValida, epiConfig, isAdmin, isAnalista: sessao.authorization.isAnalista, visibleScreens: sessao.authorization.visibleScreens }),
    visibleScreens: sessao.authorization.visibleScreens,
    classificacao: sessao.authorization.classificacao ?? "INTERNO",
  }
}

/**
 * Guard de ROTA por tela (Eixo 1). Chame no topo de um page.tsx protegido com a
 * `key` da tela (domains.ts). Admin/dev passam sempre. Sem a tela concedida →
 * redireciona para a Home.
 */
export async function assertTelaVisivel(telaKey: string): Promise<void> {
  const papeis = await resolverPapeisDashboard()
  if (papeis.isAdmin) return
  if (!papeis.visibleScreens.includes(telaKey)) redirect("/dashboards")
}
