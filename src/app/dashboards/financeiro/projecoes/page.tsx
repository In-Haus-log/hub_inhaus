import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, Search } from "lucide-react"

import { moeda, percentual } from "@/components/flash/moeda"
import { ListaPecs } from "@/components/projecoes/ListaPecs"
import { ProjecoesVisaoInfo } from "@/components/projecoes/ProjecoesVisaoInfo"
import { SeletorPeriodo } from "@/components/projecoes/SeletorPeriodo"
import { assertTelaVisivel } from "@/lib/dashboard-acesso"
import { rotuloPeriodo, semanaDoMes, type Periodo } from "@/lib/flash/semanas"
import { periodoSchema } from "@/lib/flash/validacao"
import { agruparPecs, DIMENSOES_VISAO, filtrarPecs, lerDim, totalizar, type LinhaPec } from "@/lib/projecoes/agrupar"
import { escopoDaPagina, TELA_PROJECOES } from "@/lib/projecoes/acesso"
import { listarVisao } from "@/lib/projecoes/visao"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Projeções" }
export const dynamic = "force-dynamic"

export default async function ProjecoesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await assertTelaVisivel(TELA_PROJECOES)
  const escopo = await escopoDaPagina()
  const lido = periodoSchema.safeParse({ mes: searchParams.mes, semana: searchParams.semana })
  const periodo: Periodo = lido.success ? lido.data : semanaDoMes(new Date())
  const dim = lerDim(searchParams.agrupar)
  const busca = typeof searchParams.q === "string" ? searchParams.q : ""

  let pecs: LinhaPec[] = []
  let erro: string | null = null
  try {
    pecs = await listarVisao(escopo, periodo)
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha ao carregar os contratos."
  }
  const visiveis = filtrarPecs(pecs, busca)
  const totais = totalizar(visiveis)
  const grupos = agruparPecs(visiveis, dim)

  const href = (p: Periodo, d = dim, q = busca) => {
    const u = new URLSearchParams({ mes: p.mes, semana: String(p.semana), agrupar: d })
    if (q) u.set("q", q)
    return `/dashboards/financeiro/projecoes?${u.toString()}`
  }

  const cards = [
    { rotulo: "ROL", valor: totais.lancados ? moeda(totais.rol) : "—", destaque: true, nota: "Receita líquida projetada" },
    { rotulo: "MC", valor: totais.lancados ? moeda(totais.mc) : "—", nota: "ROL menos os custos", negativo: totais.mc < 0 },
    { rotulo: "% Margem", valor: percentual(totais.margem), nota: "MC ÷ ROL", negativo: totais.mc < 0 },
  ]

  return (
    <div className="space-y-6">
      <section className="reveal">
        <span className="eyebrow">Financeiro</span>
        <div className="mt-3 flex items-center gap-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-navy">Projeções</h1>
          <ProjecoesVisaoInfo />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {rotuloPeriodo(periodo)}
          {pecs.length > 0 && <> · {totais.lancados} de {totais.total} contratos com lançamento</>}
        </p>
      </section>

      <section className="reveal delay-1 flex flex-wrap items-center justify-between gap-4" aria-label="Filtros">
        <SeletorPeriodo periodo={periodo} href={(p) => href(p)} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2" role="group" aria-label="Agrupar por">
            <span className="text-xs text-muted-foreground">Agrupar por</span>
            <div className="flex rounded-2xl border border-navy/10 bg-white/70 p-1">
              {DIMENSOES_VISAO.map((d) => (
                <Link
                  key={d.chave}
                  href={href(periodo, d.chave)}
                  aria-current={d.chave === dim ? "page" : undefined}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
                    d.chave === dim ? "bg-inhaus-grad text-white shadow-glow" : "text-navy hover:bg-navy-mist",
                  )}
                >
                  {d.rotulo}
                </Link>
              ))}
            </div>
          </div>
          <form method="get" role="search" className="relative">
            <input type="hidden" name="mes" value={periodo.mes} />
            <input type="hidden" name="semana" value={periodo.semana} />
            <input type="hidden" name="agrupar" value={dim} />
            <label htmlFor="busca-pec" className="sr-only">Buscar contrato</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="busca-pec"
              name="q"
              defaultValue={busca}
              placeholder="Buscar PEC, CR, gerente ou cliente"
              className="h-10 w-72 rounded-xl border border-navy/15 bg-white pl-9 pr-3 text-sm text-navy outline-none transition focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/30"
            />
          </form>
        </div>
      </section>

      {erro && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </div>
      )}

      {!erro && pecs.length > 0 && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Totais do recorte">
          {cards.map((c, i) => (
            <div key={c.rotulo} className={cn("reveal rounded-3xl p-5", `delay-${i + 1}`, c.destaque ? "bg-inhaus-grad text-white shadow-glow" : "glass")}>
              <p className={cn("text-xs", c.destaque ? "text-white/75" : "text-muted-foreground")}>{c.rotulo}</p>
              <p className={cn("mt-1 font-display text-2xl font-semibold tabular-nums", c.destaque ? "text-white" : c.negativo ? "text-red-700" : "text-navy")}>{c.valor}</p>
              <p className={cn("mt-0.5 text-xs", c.destaque ? "text-white/70" : "text-muted-foreground")}>{c.nota}</p>
            </div>
          ))}
        </section>
      )}

      {!erro && pecs.length === 0 && (
        <div className="glass rounded-3xl p-8 text-center">
          <p className="font-display text-lg font-semibold text-navy">Nenhum contrato parametrizado ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Habilite um PEC no Flash Report para começar a projetar.</p>
          <Link href="/dashboards/financeiro/flash-report" className="mt-4 inline-flex h-10 items-center rounded-xl bg-inhaus-grad px-5 text-sm font-semibold text-white shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2">
            Ir para o Flash Report
          </Link>
        </div>
      )}

      {!erro && pecs.length > 0 && visiveis.length === 0 && (
        <p className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">Nenhum contrato encontrado para “{busca}”.</p>
      )}

      {!erro && visiveis.length > 0 && <ListaPecs grupos={grupos} dim={dim} periodo={periodo} />}
    </div>
  )
}
