import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { acessoPowerBi, listarClientesBi } from "@/lib/powerbi-acesso"
import { powerbiDb } from "@/lib/powerbi-db"
import { linkPowerBiValido } from "@/lib/powerbi-validacao"
import { invalidarAutorizacaoLocal } from "@/lib/auth-session"

export const dynamic = "force-dynamic"
const cadastro = z.object({
  nome: z.string().trim().min(1,"Informe o nome do cliente").max(120),
  titulo: z.string().trim().max(120).optional(),
  url: z.string().trim().max(4096).optional(),
}).refine(d => Boolean(d.titulo) === Boolean(d.url), "Informe o título e o link do primeiro relatório")
  .refine(d => !d.url || linkPowerBiValido(d.url), "Informe um link de incorporação válido do Power BI")

export async function GET() {
  const g = await acessoPowerBi()
  if (g.response) return g.response
  try { return NextResponse.json({ clientes: await listarClientesBi(g.ctx) }) }
  catch { return NextResponse.json({ error: "Não foi possível carregar os clientes." }, { status: 500 }) }
}

export async function POST(request: Request) {
  const g = await acessoPowerBi(true)
  if (g.response) return g.response
  const input = cadastro.safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message }, { status: 400 })
  if (!g.ctx.isAdmin && !g.ctx.email) return NextResponse.json({ error: "Sessão inválida." }, { status: 403 })
  const { nome,titulo,url } = input.data
  const base = nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70) || "cliente"
  try {
    // Cliente, relatório opcional e permissão do criador são atômicos.
    const r = await powerbiDb.query(`WITH novo AS (
      INSERT INTO cliente_contratante(nome,slug,ativo) VALUES ($1,$2,true) RETURNING id,nome,slug
    ), painel AS (
      INSERT INTO dm_powerbi_painel(cliente_id,titulo,url) SELECT id,$3::text,$4::text FROM novo WHERE $3::text IS NOT NULL
    ), permissao AS (
      UPDATE auth_users SET visible_screens=array_append(visible_screens,'cliente-bi:' || (SELECT id::text FROM novo))
      WHERE lower(email)=lower($5) AND has_access=true
    ) SELECT id,nome,slug FROM novo`, [nome,`${base}-${randomUUID().slice(0,8)}`,titulo || null,url || null,g.ctx.email])
    if (g.ctx.email) invalidarAutorizacaoLocal(g.ctx.email)
    return NextResponse.json({ cliente: r.rows[0] }, { status: 201 })
  } catch (e) {
    const duplicado = (e as {code?:string}).code === "23505"
    return NextResponse.json({ error: duplicado ? "Já existe um cliente com esse nome. Selecione o cliente existente." : "Não foi possível cadastrar o cliente." }, { status: duplicado ? 409 : 500 })
  }
}
