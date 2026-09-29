import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { semanasDoMes, type Periodo } from "@/lib/flash/semanas"
import { cn } from "@/lib/utils"

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

function mesVizinho(mes: string, passo: number): string {
  const [a, m] = mes.split("-").map(Number)
  const d = new Date(Date.UTC(a, m - 1 + passo, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Navegação de mês e semana por links (estado na URL). `href` monta a URL preservando os demais filtros. */
export function SeletorPeriodo({ periodo, href }: { periodo: Periodo; href: (p: Periodo) => string }) {
  const [ano, mesNum] = periodo.mes.split("-").map(Number)
  const seta = "rounded-lg p-1.5 text-navy hover:bg-navy-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Período">
      <div className="flex items-center gap-1">
        <Link href={href({ mes: mesVizinho(periodo.mes, -1), semana: 1 })} aria-label="Mês anterior" className={seta}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
        <span className="min-w-[8.5rem] text-center font-display text-sm font-semibold text-navy">
          {MESES[mesNum - 1]} {ano}
        </span>
        <Link href={href({ mes: mesVizinho(periodo.mes, 1), semana: 1 })} aria-label="Próximo mês" className={seta}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className="flex rounded-2xl border border-navy/10 bg-white/70 p-1">
        {semanasDoMes(periodo.mes).map((n) => {
          const ativa = n === periodo.semana
          return (
            <Link
              key={n}
              href={href({ mes: periodo.mes, semana: n })}
              aria-current={ativa ? "page" : undefined}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
                ativa ? "bg-inhaus-grad text-white shadow-glow" : "text-navy hover:bg-navy-mist",
              )}
            >
              Sem {n}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
