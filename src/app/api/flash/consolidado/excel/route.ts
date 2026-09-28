import { NextResponse } from "next/server"

import { erroZod, responderErro } from "@/app/api/flash/_resposta"
import { guardaFlash } from "@/lib/flash/acesso"
import { consolidado } from "@/lib/flash/dados"
import { gerarExcelConsolidado } from "@/lib/flash/excel"
import { mesSchema } from "@/lib/flash/validacao"

export const dynamic = "force-dynamic"

const SIGLAS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]

// GET ?mes=YYYY-MM — Excel do consolidado no layout da guia "Flash Report".
export async function GET(req: Request) {
  const g = await guardaFlash({ consolidado: true }); if (!g.ok) return g.response
  const m = mesSchema.safeParse({ mes: new URL(req.url).searchParams.get("mes") })
  if (!m.success) return erroZod(m.error)
  try {
    const linhas = await consolidado(g.escopo, m.data.mes)
    const buf = await gerarExcelConsolidado(m.data.mes, linhas)
    const ultima = Math.max(0, ...linhas.flatMap((l) => Object.entries(l.semanas).filter(([, s]) => s?.status === "ENVIADO").map(([n]) => Number(n))))
    const [ano, mes] = m.data.mes.split("-")
    const nome = `FLASH REPORT LOGISTICA_${SIGLAS[Number(mes) - 1]}${ano.slice(2)}${ultima ? `-SEM${ultima}` : ""}.xlsx`
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nome}"`,
      },
    })
  } catch (e) {
    return responderErro(e)
  }
}
