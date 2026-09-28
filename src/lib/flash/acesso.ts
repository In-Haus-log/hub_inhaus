import { NextResponse } from "next/server"

import { getCurrentSession, getSessionReadOnly } from "@/lib/auth-session"
import { acessoLivreLiberado } from "@/lib/dev-auth"
import { resolverEscopoDados, type EscopoDados } from "@/lib/seguranca/escopo-dados"

/**
 * Acesso ao Flash Report.
 *  - Tela `flash-report`: o gestor lança a projeção dos PECs dos SEUS CRs.
 *  - Tela `flash-report-consolidado`: financeiro/diretoria acompanham envios, reabrem e exportam.
 * O recorte de dados é SEMPRE o escopo de CRs do usuário (Trava 1 + Trava 2 em dados.ts).
 */
export const TELA_FLASH = "flash-report"
export const TELA_FLASH_CONSOLIDADO = "flash-report-consolidado"

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

export async function usuarioAtual(): Promise<{ nome: string; podeConsolidar: boolean }> {
  if (acessoLivreLiberado()) return { nome: "Visitante", podeConsolidar: true }
  const r = await getSessionReadOnly()
  if (r.status !== "ok") return { nome: "", podeConsolidar: false }
  const a = r.sessao.authorization
  return { nome: a.nome ?? a.email, podeConsolidar: a.isAdmin || a.visibleScreens.includes(TELA_FLASH_CONSOLIDADO) }
}

export async function guardaFlash(opts: { consolidado?: boolean } = {}): Promise<
  | { ok: true; escopo: EscopoDados; usuario: string; podeConsolidar: boolean }
  | { ok: false; response: NextResponse }
> {
  if (acessoLivreLiberado()) return { ok: true, escopo: { tipo: "todos" }, usuario: "Visitante", podeConsolidar: true }
  const sessao = await getCurrentSession()
  if (!sessao) return { ok: false, response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  const { isAdmin, visibleScreens, classificacao, nome, email } = sessao.authorization
  const podeConsolidar = isAdmin || visibleScreens.includes(TELA_FLASH_CONSOLIDADO)
  const podeLancar = isAdmin || visibleScreens.includes(TELA_FLASH)
  if (opts.consolidado ? !podeConsolidar : !(podeLancar || podeConsolidar)) {
    return { ok: false, response: NextResponse.json({ error: "Acesso restrito" }, { status: 403 }) }
  }
  const escopo = await resolverEscopoDados({ authUserId: sessao.user.id, isAdmin, classificacao })
  return { ok: true, escopo, usuario: nome ?? email, podeConsolidar }
}
