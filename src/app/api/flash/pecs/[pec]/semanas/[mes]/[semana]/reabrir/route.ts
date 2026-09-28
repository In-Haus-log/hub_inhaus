import { NextResponse } from "next/server"

import { erroZod, responderErro } from "@/app/api/flash/_resposta"
import { guardaFlash } from "@/lib/flash/acesso"
import { reabrirSemana } from "@/lib/flash/dados"
import { periodoSchema, reaberturaSchema } from "@/lib/flash/validacao"

export const dynamic = "force-dynamic"

type Ctx = { params: { pec: string; mes: string; semana: string } }

// POST — o financeiro reabre uma semana enviada (motivo obrigatório).
export async function POST(req: Request, ctx: Ctx) {
  const g = await guardaFlash({ consolidado: true }); if (!g.ok) return g.response
  const p = periodoSchema.safeParse({ mes: ctx.params.mes, semana: ctx.params.semana }); if (!p.success) return erroZod(p.error)
  const b = reaberturaSchema.safeParse(await req.json().catch(() => null)); if (!b.success) return erroZod(b.error)
  try { await reabrirSemana(g.escopo, ctx.params.pec, p.data, b.data.motivo, g.usuario); return NextResponse.json({ ok: true }) } catch (e) { return responderErro(e) }
}
