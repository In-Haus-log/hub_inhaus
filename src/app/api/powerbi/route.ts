import { NextResponse } from "next/server"
import { z } from "zod"
import { powerbiDb } from "@/lib/powerbi-db"
import { cadastroPowerBi } from "@/lib/powerbi-validacao"
import { acessoPowerBi, listarClientesBi } from "@/lib/powerbi-acesso"
import { ICONE_BI_PADRAO } from "@/lib/powerbi-icones"

export const dynamic = "force-dynamic"
const erro = (error: string, status: number) => NextResponse.json({ error }, { status })

export async function GET() {
  const g = await acessoPowerBi()
  if (g.response) return g.response
  try {
    const clientes = await listarClientesBi(g.ctx)
    const { rows } = await powerbiDb.query(`SELECT p.id,p.titulo,p.cliente_id AS "clienteId",p.url,p.documentacao,p.icone
      FROM dm_powerbi_painel p JOIN cliente_contratante c ON c.id=p.cliente_id AND c.ativo=true
      WHERE ($1::boolean OR p.cliente_id=ANY($2::integer[])) ORDER BY p.id`, [g.ctx.isAdmin,g.ctx.ids])
    const permitidos = new Set(clientes.map(c => c.id))
    if (rows.some(r => !permitidos.has(r.clienteId))) throw new Error("Cliente fora do escopo")
    return NextResponse.json({ clientes, paineis: rows })
  } catch { return erro("Não foi possível carregar os relatórios.",500) }
}

export async function POST(request: Request) {
  const g = await acessoPowerBi(true)
  if (g.response) return g.response
  const input = cadastroPowerBi.safeParse(await request.json().catch(() => null))
  if (!input.success) return erro(input.error.issues[0]?.message ?? "Dados inválidos",400)
  try {
    const d = input.data
    const r = await powerbiDb.query(`INSERT INTO dm_powerbi_painel(cliente_id,titulo,url,documentacao,icone)
      SELECT c.id,$2,$3,$6,$7 FROM cliente_contratante c WHERE c.id=$1 AND c.ativo=true
      AND ($4::boolean OR c.id=ANY($5::integer[])) RETURNING id`, [d.clienteId,d.titulo,d.url,g.ctx.isAdmin,g.ctx.ids,d.documentacao ?? "",d.icone ?? ICONE_BI_PADRAO])
    if (!r.rowCount) return erro("Cliente não encontrado ou sem permissão.",403)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch { return erro("Não foi possível salvar. Tente novamente.",500) }
}

export async function DELETE(request: Request) {
  const g = await acessoPowerBi(true)
  if (g.response) return g.response
  const params = new URL(request.url).searchParams
  const id = Number(params.get("id"))
  if ((params.has("tipo") && params.get("tipo") !== "painel") || !Number.isSafeInteger(id) || id < 1) return erro("Registro inválido.",400)
  try {
    const r = await powerbiDb.query(`DELETE FROM dm_powerbi_painel p USING cliente_contratante c
      WHERE p.id=$1 AND c.id=p.cliente_id AND c.ativo=true
      AND ($2::boolean OR p.cliente_id=ANY($3::integer[])) RETURNING p.id`, [id,g.ctx.isAdmin,g.ctx.ids])
    if (!r.rowCount) return erro("Relatório não encontrado ou sem permissão.",404)
    return NextResponse.json({ ok: true })
  } catch { return erro("Não foi possível excluir.",500) }
}

export async function PATCH(request: Request) {
  const g = await acessoPowerBi(true)
  if (g.response) return g.response
  const body: unknown = await request.json().catch(() => null)
  const input = cadastroPowerBi.extend({ id: z.number().int().positive() }).safeParse(body)
  if (!input.success) return erro(input.error.issues[0]?.message ?? "Registro inválido.",400)
  try {
    const d = input.data
    const r = await powerbiDb.query(`UPDATE dm_powerbi_painel p SET titulo=$2,url=$3,cliente_id=$4,documentacao=COALESCE($7::text,p.documentacao),icone=COALESCE($8::varchar(40),p.icone)
      FROM cliente_contratante c WHERE p.id=$1 AND c.id=$4 AND c.ativo=true
      AND ($5::boolean OR (p.cliente_id=ANY($6::integer[]) AND c.id=ANY($6::integer[])))
      RETURNING p.id`, [d.id,d.titulo,d.url,d.clienteId,g.ctx.isAdmin,g.ctx.ids,d.documentacao ?? null,d.icone ?? null])
    if (!r.rowCount) return erro("Relatório não encontrado ou sem permissão.",404)
    return NextResponse.json({ ok: true })
  } catch { return erro("Não foi possível salvar. Tente novamente.",500) }
}
