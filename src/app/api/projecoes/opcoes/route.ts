import { NextResponse } from "next/server"

import { guardaProjecoes } from "@/lib/projecoes/acesso"
import { getOpcoes } from "@/lib/projecoes/dados"
import { ehDimensao } from "@/lib/projecoes/dimensoes"
import { lerEstado } from "@/lib/projecoes/parametros"

export const dynamic = "force-dynamic"

// GET /api/projecoes/opcoes?<estado>&dim=<dimensão> — valores possíveis de um filtro,
// considerando os demais filtros ativos (o próprio filtro da dimensão é ignorado).
export async function GET(request: Request) {
  const g = await guardaProjecoes()
  if (!g.ok) return g.response

  const sp = new URL(request.url).searchParams
  const dim = sp.get("dim") ?? ""
  if (!ehDimensao(dim)) return NextResponse.json({ error: "Dimensão inválida." }, { status: 400 })
  const estado = lerEstado(sp)
  if (!estado.periodo) return NextResponse.json({ error: "Informe o período." }, { status: 400 })

  const filtros = { ...estado.filtros }
  delete filtros[dim]

  try {
    const opcoes = await getOpcoes(dim, { periodo: estado.periodo, filtros, caminho: [] }, g.escopo)
    return NextResponse.json({ opcoes })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao consultar" }, { status: 500 })
  }
}
