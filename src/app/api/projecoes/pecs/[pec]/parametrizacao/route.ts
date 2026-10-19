import { escopoRegionalProjecoes } from "@/lib/projecoes/regional"
import { NextResponse } from "next/server"
import { responderErro } from "@/app/api/flash/_resposta"
import { guardaProjecoes } from "@/lib/projecoes/acesso"
import { garantirPecNoEscopo, listarItens } from "@/lib/flash/dados"
import { crsDoPec } from "@/lib/projecoes/catalogo"
import { getCurrentSession } from "@/lib/auth-session"
import { acessoLivreLiberado } from "@/lib/dev-auth"
import { TELA_FLASH, TELA_FLASH_CONSOLIDADO } from "@/lib/flash/acesso"
export const dynamic = "force-dynamic"
export async function GET(_: Request, { params }: { params: { pec: string } }) {
  const g = await guardaProjecoes(); if (!g.ok) return g.response
  try {
    const escopo = await escopoRegionalProjecoes(g.escopo)
    const [pec, itens, crs] = await Promise.all([garantirPecNoEscopo(escopo, params.pec), listarItens(escopo, params.pec), crsDoPec(escopo, params.pec)])
    const sessao = acessoLivreLiberado() ? null : await getCurrentSession()
    const a = sessao?.authorization
    // Mesma autorização de escrita já aplicada pelas rotas do Flash Report.
    const podeLancar = acessoLivreLiberado() || !!a && (a.isAdmin || a.visibleScreens.includes(TELA_FLASH) || a.visibleScreens.includes(TELA_FLASH_CONSOLIDADO))
    return NextResponse.json({ pec, itens, crs, podeLancar, podeParametrizar: podeLancar })
  } catch (e) { return responderErro(e) }
}
