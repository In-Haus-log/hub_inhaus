import { NextResponse } from "next/server"

import { erroZod, responderErro } from "@/app/api/flash/_resposta"
import { guardaFlash } from "@/lib/flash/acesso"
import { listarItens, salvarItem } from "@/lib/flash/dados"
import { itemSchema } from "@/lib/flash/validacao"

export const dynamic = "force-dynamic"

type Ctx = { params: { pec: string } }

// GET — itens cobrados do PEC (parametrização).
export async function GET(_: Request, ctx: Ctx) {
  const g = await guardaFlash(); if (!g.ok) return g.response
  try { return NextResponse.json({ itens: await listarItens(g.escopo, ctx.params.pec) }) } catch (e) { return responderErro(e) }
}

// POST — cria um item.
export async function POST(req: Request, ctx: Ctx) {
  const g = await guardaFlash(); if (!g.ok) return g.response
  const b = itemSchema.safeParse(await req.json().catch(() => null)); if (!b.success) return erroZod(b.error)
  try { return NextResponse.json(await salvarItem(g.escopo, ctx.params.pec, b.data)) } catch (e) { return responderErro(e) }
}
