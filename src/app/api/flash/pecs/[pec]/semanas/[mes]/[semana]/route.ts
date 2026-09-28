import { NextResponse } from "next/server"

import { erroZod, responderErro } from "@/app/api/flash/_resposta"
import { guardaFlash } from "@/lib/flash/acesso"
import { abrirSemana, enviarSemana, salvarRascunho } from "@/lib/flash/dados"
import { periodoSchema, rascunhoSchema } from "@/lib/flash/validacao"

export const dynamic = "force-dynamic"

type Ctx = { params: { pec: string; mes: string; semana: string } }

function periodo(ctx: Ctx) {
  return periodoSchema.safeParse({ mes: ctx.params.mes, semana: ctx.params.semana })
}

// GET — abre (ou cria como rascunho) a projeção da semana.
export async function GET(_: Request, ctx: Ctx) {
  const g = await guardaFlash(); if (!g.ok) return g.response
  const p = periodo(ctx); if (!p.success) return erroZod(p.error)
  try { return NextResponse.json(await abrirSemana(g.escopo, ctx.params.pec, p.data)) } catch (e) { return responderErro(e) }
}

// PUT — salva o rascunho (salvamento automático da tela).
export async function PUT(req: Request, ctx: Ctx) {
  const g = await guardaFlash(); if (!g.ok) return g.response
  const p = periodo(ctx); if (!p.success) return erroZod(p.error)
  const b = rascunhoSchema.safeParse(await req.json().catch(() => null)); if (!b.success) return erroZod(b.error)
  try { return NextResponse.json(await salvarRascunho(g.escopo, ctx.params.pec, p.data, b.data)) } catch (e) { return responderErro(e) }
}

// POST — envia a semana (trava).
export async function POST(req: Request, ctx: Ctx) {
  const g = await guardaFlash(); if (!g.ok) return g.response
  const p = periodo(ctx); if (!p.success) return erroZod(p.error)
  const b = rascunhoSchema.safeParse(await req.json().catch(() => null)); if (!b.success) return erroZod(b.error)
  try { return NextResponse.json(await enviarSemana(g.escopo, ctx.params.pec, p.data, b.data, g.usuario)) } catch (e) { return responderErro(e) }
}
