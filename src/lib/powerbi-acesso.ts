import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth-session"
import { acessoLivreLiberado } from "@/lib/dev-auth"
import { powerbiDb } from "@/lib/powerbi-db"
import { idsClientesBi, type ClienteBi } from "@/lib/powerbi-permissoes"

export type AcessoBi = { isAdmin: boolean; gerencia: boolean; ids: number[]; email: string | null }
export async function acessoPowerBi(escrita = false): Promise<{ ctx: AcessoBi; response?: never } | { response: NextResponse; ctx?: never }> {
  if (acessoLivreLiberado()) return { ctx: { isAdmin: true, gerencia: true, ids: [], email: null } }
  const guard = await requireSession()
  if (!guard.ok) return { response: guard.response }
  const a = guard.sessao.authorization
  const ctx = { isAdmin: a.isAdmin, gerencia: a.isAdmin || Boolean(a.isAnalista), ids: idsClientesBi(a.visibleScreens), email: a.email }
  if (escrita && !ctx.gerencia) return { response: NextResponse.json({ error: "Você não tem permissão para alterar os relatórios." }, { status: 403 }) }
  return { ctx }
}

export async function listarClientesBi(ctx: Pick<AcessoBi, "isAdmin" | "ids">): Promise<ClienteBi[]> {
  const { rows } = await powerbiDb.query(`SELECT c.id,c.nome,c.slug,
    COALESCE(json_agg(json_build_object('id',p.id,'titulo',p.titulo,'icone',p.icone) ORDER BY p.id)
      FILTER (WHERE p.id IS NOT NULL),'[]') AS relatorios
    FROM cliente_contratante c
    LEFT JOIN dm_powerbi_painel p ON p.cliente_id=c.id
    WHERE c.ativo=true AND ($1::boolean OR c.id=ANY($2::integer[]))
    GROUP BY c.id ORDER BY c.nome`, [ctx.isAdmin, ctx.ids])
  return rows as ClienteBi[]
}
