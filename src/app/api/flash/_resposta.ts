import { NextResponse } from "next/server"
import type { ZodError } from "zod"

import { ErroFlash } from "@/lib/flash/dados"

export const erroZod = (e: ZodError) => NextResponse.json({ error: e.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })

export function responderErro(e: unknown) {
  if (e instanceof ErroFlash) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error("[flash-report]", e)
  return NextResponse.json({ error: "Falha ao processar o Flash Report." }, { status: 500 })
}
