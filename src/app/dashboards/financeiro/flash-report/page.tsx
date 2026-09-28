import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, ArrowRight, Sheet, TrendingDown, TrendingUp } from "lucide-react"

import { FlashInfo } from "@/components/flash/FlashInfo"
import { HabilitarPec } from "@/components/flash/HabilitarPec"
import { moeda, nomeDoPec, variacaoMoeda } from "@/components/flash/moeda"
import { SeloStatus } from "@/components/flash/SeloStatus"
import { assertTelaVisivel } from "@/lib/dashboard-acesso"
import { escopoDaPagina, TELA_FLASH, usuarioAtual } from "@/lib/flash/acesso"
import { listarMeusPecs, type ResumoPec } from "@/lib/flash/dados"
import { rotuloPeriodo, semanaDoMes } from "@/lib/flash/semanas"
import { tituloNome } from "@/lib/nomes"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Flash Report" }
export const dynamic = "force-dynamic"

const DELAYS = ["delay-1", "delay-2", "delay-3", "delay-4", "delay-5"]

export default async function FlashReportPage() {
  await assertTelaVisivel(TELA_FLASH)
  const [escopo, usuario] = await Promise.all([escopoDaPagina(), usuarioAtual()])
  const periodo = semanaDoMes(new Date())

  let pecs: ResumoPec[] = []
  let erro: string | null = null
  try {
    pecs = await listarMeusPecs(escopo, periodo)
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha ao carregar os PECs."
  }
  const enviados = pecs.filter((p) => p.status === "ENVIADO").length
  const qs = `?mes=${periodo.mes}&semana=${periodo.semana}`

  return (
    <div className="space-y-6">
      <section className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Financeiro</span>
          <div className="mt-3 flex items-center gap-2.5">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-navy">Flash Report</h1>
            <FlashInfo />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Projeção de receita do mês · <strong className="font-medium text-navy">{rotuloPeriodo(periodo)}</strong>
            {pecs.length > 0 && (
              <>
                {" "}· {enviados} de {pecs.length} enviados
              </>
            )}
          </p>
        </div>
        {usuario.podeConsolidar && (
          <Link
            href="/dashboards/financeiro/flash-report/consolidado"
            className="inline-flex items-center gap-2 rounded-xl border border-navy/10 bg-white/70 px-4 py-2 text-sm font-medium text-navy transition hover:-translate-y-0.5 hover:border-teal/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            <Sheet className="h-4 w-4 text-teal" aria-hidden /> Consolidado
          </Link>
        )}
      </section>

      {erro && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </div>
      )}

      {pecs.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Seus PECs">
          {pecs.map((p, i) => (
            <li key={p.pecCod} className={cn("reveal", DELAYS[i % DELAYS.length])}>
              <Link
                href={`/dashboards/financeiro/flash-report/${p.pecCod}${qs}`}
                className="group glass flex h-full flex-col rounded-3xl p-5 transition hover:-translate-y-1 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      PEC {p.pecCod} · CR {p.crCod}
                    </p>
                    <h2 className="mt-1 truncate font-display text-lg font-semibold text-navy">
                      {tituloNome(nomeDoPec(p.pecNome))}
                    </h2>
                  </div>
                  <SeloStatus status={p.status} />
                </div>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Receita líquida projetada</p>
                    <p className="font-display text-2xl font-semibold tabular-nums text-navy">
                      {p.status === "PENDENTE" ? "—" : moeda(p.receitaLiquida)}
                    </p>
                  </div>
                  {p.variacao != null && (
                    <p
                      className={cn(
                        "inline-flex items-center gap-1 text-sm font-medium tabular-nums",
                        p.variacao >= 0 ? "text-emerald-700" : "text-red-700",
                      )}
                    >
                      {p.variacao >= 0 ? (
                        <TrendingUp className="h-4 w-4" aria-hidden />
                      ) : (
                        <TrendingDown className="h-4 w-4" aria-hidden />
                      )}
                      {variacaoMoeda(p.variacao)}
                      <span className="sr-only"> em relação à semana anterior</span>
                    </p>
                  )}
                </div>
                <p className="mt-4 flex items-center gap-1 text-sm font-medium text-teal">
                  {p.status === "ENVIADO" ? "Ver projeção" : "Lançar semana"}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="glass reveal rounded-3xl p-6" aria-labelledby="novo-pec">
        <h2 id="novo-pec" className="font-display text-base font-semibold text-navy">
          {pecs.length === 0 ? "Comece adicionando o primeiro PEC" : "Adicionar outro PEC"}
        </h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Depois de adicionar, cadastre os itens cobrados do contrato (funções, hora extra, caminhões, descontos…). Isso é
          feito uma vez só.
        </p>
        <HabilitarPec />
      </section>
    </div>
  )
}
