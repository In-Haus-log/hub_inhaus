import { NextResponse } from "next/server"

import { guardaProjecoes } from "@/lib/projecoes/acesso"
import { getNivel } from "@/lib/projecoes/dados"
import { caminhoDe, lerEstado } from "@/lib/projecoes/parametros"

export const dynamic = "force-dynamic"

// GET /api/projecoes/nivel?<estado>&c=<valor do nível 1>&c=… — filhos de uma linha aberta.
export async function GET(request: Request) {
  const g = await guardaProjecoes()
  if (!g.ok) return g.response

  const sp = new URL(request.url).searchParams
  const estado = lerEstado(sp)
  if (!estado.periodo) return NextResponse.json({ error: "Informe o período." }, { status: 400 })
  const caminho = caminhoDe(estado.niveis, sp.getAll("c"))
  if (!caminho || caminho.length >= estado.niveis.length) {
    return NextResponse.json({ error: "Nível inválido." }, { status: 400 })
  }

  try {
    const nos = await getNivel(
      estado.niveis[caminho.length],
      { periodo: estado.periodo, filtros: estado.filtros, caminho },
      g.escopo,
    )
    return NextResponse.json({ nos })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao consultar" }, { status: 500 })
  }
}
