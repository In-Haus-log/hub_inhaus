import { NextResponse } from "next/server"

import { getCurrentSession, getSessionReadOnly } from "@/lib/auth-session"
import { acessoLivreLiberado } from "@/lib/dev-auth"
import { resolverEscopoDados, type EscopoDados } from "@/lib/seguranca/escopo-dados"

/**
 * Acesso ao RE x OR. Duas perguntas separadas:
 *  - QUAL TELA (Eixo 1): a tela `projecoes-analise` precisa estar concedida (admin passa).
 *  - QUAIS DADOS (Eixo 2): o escopo de CRs do usuário (gestão = todos; gerente = os seus).
 * Honra o acesso livre de dev (Visitante admin interno vê tudo).
 */
export const TELA_PROJECOES = "projecoes-analise"

/** Escopo de dados para a PÁGINA (a tela já foi validada por assertTelaVisivel). */
export async function escopoDaPagina(): Promise<EscopoDados> {
  if (acessoLivreLiberado()) return { tipo: "todos" }
  const r = await getSessionReadOnly()
  if (r.status !== "ok") return { tipo: "lista", crs: [] }
  return resolverEscopoDados({
    authUserId: r.sessao.user.id,
    isAdmin: r.sessao.authorization.isAdmin,
    classificacao: r.sessao.authorization.classificacao,
  })
}

/** Guarda das rotas de API: exige a tela concedida e devolve o escopo de dados. */
export async function guardaProjecoes(): Promise<
  { ok: true; escopo: EscopoDados } | { ok: false; response: NextResponse }
> {
  if (acessoLivreLiberado()) return { ok: true, escopo: { tipo: "todos" } }
  const sessao = await getCurrentSession()
  if (!sessao) {
    return { ok: false, response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  }
  const { isAdmin, visibleScreens, classificacao } = sessao.authorization
  if (!isAdmin && !visibleScreens.includes(TELA_PROJECOES)) {
    return { ok: false, response: NextResponse.json({ error: "Acesso restrito" }, { status: 403 }) }
  }
  const escopo = await resolverEscopoDados({ authUserId: sessao.user.id, isAdmin, classificacao })
  return { ok: true, escopo }
}
