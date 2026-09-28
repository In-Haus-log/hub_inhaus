import { NextResponse } from "next/server"
import { z } from "zod"

import { erroZod, responderErro } from "@/app/api/flash/_resposta"
import { guardaFlash } from "@/lib/flash/acesso"
import { habilitarPec, pecsDisponiveis } from "@/lib/flash/dados"

export const dynamic = "force-dynamic"

// GET — PECs do escopo que ainda não participam do Flash Report.
export async function GET() {
  const g = await guardaFlash(); if (!g.ok) return g.response
  try { return NextResponse.json({ pecs: await pecsDisponiveis(g.escopo) }) } catch (e) { return responderErro(e) }
}

// POST — habilita um PEC no Flash Report.
export async function POST(req: Request) {
  const g = await guardaFlash(); if (!g.ok) return g.response
  const b = z.object({ pecCod: z.string().regex(/^\d{6}$/, "PEC inválido") }).safeParse(await req.json().catch(() => null))
  if (!b.success) return erroZod(b.error)
  try { await habilitarPec(g.escopo, b.data.pecCod, g.usuario); return NextResponse.json({ ok: true }) } catch (e) { return responderErro(e) }
}
