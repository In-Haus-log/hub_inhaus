import { NextResponse } from "next/server"

import { guardaProjecoes } from "@/lib/projecoes/acesso"
import { getLancamentos, getLancamentosCsv } from "@/lib/projecoes/dados"
import { caminhoDe, lerEstado } from "@/lib/projecoes/parametros"

export const dynamic = "force-dynamic"

const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/

// GET /api/projecoes/lancamentos?<estado>&c=…[&mes=AAAA-MM]&pagina=N[&formato=csv]
// Lançamentos que formam um número da tabela (célula de um mês ou total do período).
export async function GET(request: Request) {
  const g = await guardaProjecoes()
  if (!g.ok) return g.response

  const sp = new URL(request.url).searchParams
  const estado = lerEstado(sp)
  if (!estado.periodo) return NextResponse.json({ error: "Informe o período." }, { status: 400 })
  const caminho = caminhoDe(estado.niveis, sp.getAll("c"))
  if (!caminho) return NextResponse.json({ error: "Linha inválida." }, { status: 400 })
  const mes = sp.get("mes")
  if (mes && !RE_MES.test(mes)) return NextResponse.json({ error: "Mês inválido." }, { status: 400 })

  const recorte = {
    periodo: mes ? { de: mes, ate: mes } : estado.periodo,
    filtros: estado.filtros,
    caminho,
  }

  try {
    if (sp.get("formato") === "csv") {
      const csv = await getLancamentosCsv(recorte, estado.medida, g.escopo)
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="lancamentos-${mes ?? "periodo"}.csv"`,
        },
      })
    }
    const pagina = Math.max(1, Number.parseInt(sp.get("pagina") ?? "1", 10) || 1)
    return NextResponse.json(await getLancamentos(recorte, estado.medida, g.escopo, pagina))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao consultar" }, { status: 500 })
  }
}
