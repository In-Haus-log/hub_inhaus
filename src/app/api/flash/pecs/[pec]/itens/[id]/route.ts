import { NextResponse } from "next/server"
import { z } from "zod"

import { erroZod, responderErro } from "@/app/api/flash/_resposta"
import { guardaFlash } from "@/lib/flash/acesso"
import { definirAtivo, salvarItem } from "@/lib/flash/dados"
import { itemSchema } from "@/lib/flash/validacao"

export const dynamic = "force-dynamic"

type Ctx = { params: { pec: string; id: string } }

const idDe = (ctx: Ctx) => z.coerce.number().int().positive().safeParse(ctx.params.id)

// PUT — edita um item (tarifa nova vale da semana atual em diante).
export async function PUT(req: Request, ctx: Ctx) {
  const g = await guardaFlash(); if (!g.ok) return g.response
  const id = idDe(ctx); if (!id.success) return erroZod(id.error)
  const b = itemSchema.safeParse(await req.json().catch(() => null)); if (!b.success) return erroZod(b.error)
  try { return NextResponse.json(await salvarItem(g.escopo, ctx.params.pec, b.data, id.data)) } catch (e) { return responderErro(e) }
}

// PATCH — ativa/desativa o item.
export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guardaFlash(); if (!g.ok) return g.response
  const id = idDe(ctx); if (!id.success) return erroZod(id.error)
  const b = z.object({ ativo: z.boolean() }).safeParse(await req.json().catch(() => null)); if (!b.success) return erroZod(b.error)
  try { await definirAtivo(g.escopo, ctx.params.pec, id.data, b.data.ativo); return NextResponse.json({ ok: true }) } catch (e) { return responderErro(e) }
}
