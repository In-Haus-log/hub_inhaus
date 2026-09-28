import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, ChevronLeft, ChevronRight, Download } from "lucide-react"

import { FlashInfo } from "@/components/flash/FlashInfo"
import { moeda, nomeDoPec } from "@/components/flash/moeda"
import { ReabrirSemana } from "@/components/flash/ReabrirSemana"
import { SeloStatus } from "@/components/flash/SeloStatus"
import { assertTelaVisivel } from "@/lib/dashboard-acesso"
import { escopoDaPagina, TELA_FLASH_CONSOLIDADO } from "@/lib/flash/acesso"
import { consolidado, type LinhaConsolidado } from "@/lib/flash/dados"
import { semanaDoMes, semanasDoMes } from "@/lib/flash/semanas"
import { mesSchema } from "@/lib/flash/validacao"
import { tituloNome } from "@/lib/nomes"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Flash Report · Consolidado" }
export const dynamic = "force-dynamic"

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

function mesVizinho(mes: string, passo: number): string {
  const [a, m] = mes.split("-").map(Number)
  const d = new Date(Date.UTC(a, m - 1 + passo, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Soma da coluna; null quando nenhum PEC tem valor (a tela mostra "—", não "R$ 0"). */
function soma(linhas: LinhaConsolidado[], f: (l: LinhaConsolidado) => number | null | undefined): number | null {
  const valores = linhas.map(f).filter((v): v is number => v != null)
  return valores.length ? valores.reduce((a, b) => a + b, 0) : null
}
const total = (v: number | null) => (v == null ? "—" : moeda(v))

export default async function ConsolidadoPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  await assertTelaVisivel(TELA_FLASH_CONSOLIDADO)
  const escopo = await escopoDaPagina()
  const hoje = semanaDoMes(new Date())
  const lido = mesSchema.safeParse({ mes: searchParams.mes })
  const mes = lido.success ? lido.data.mes : hoje.mes
  const semanas = semanasDoMes(mes)
  // Semana de referência do painel de envio: a atual no mês corrente; a última nos meses passados.
  const semanaRef = mes === hoje.mes ? hoje.semana : semanas[semanas.length - 1]

  let linhas: LinhaConsolidado[] = []
  let erro: string | null = null
  try {
    linhas = await consolidado(escopo, mes)
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha ao carregar o consolidado."
  }

  const enviados = linhas.filter((l) => l.semanas[semanaRef]?.status === "ENVIADO")
  const pendentes = linhas.filter((l) => l.semanas[semanaRef]?.status !== "ENVIADO")
  const pct = linhas.length ? Math.round((enviados.length / linhas.length) * 100) : 0
  const porGerente = new Map<string, LinhaConsolidado[]>()
  for (const l of linhas) {
    const g = l.pec.gerente ?? "Sem gerente"
    porGerente.set(g, [...(porGerente.get(g) ?? []), l])
  }
  const [ano, mesNum] = mes.split("-").map(Number)
  const liquidaSemana = (n: number) => (l: LinhaConsolidado) => l.semanas[n]?.receitaLiquida

  return (
    <div className="space-y-6">
      <section className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <nav aria-label="Caminho" className="text-xs text-muted-foreground">
            <Link href="/dashboards/financeiro/flash-report" className="hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
              Flash Report
            </Link>{" "}
            › Consolidado
          </nav>
          <div className="mt-3 flex items-center gap-2.5">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-navy">Consolidado</h1>
            <FlashInfo />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Receita líquida projetada por PEC, semana a semana, e o realizado do mês.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-2xl border border-navy/10 bg-white/70 p-1">
            <Link href={`?mes=${mesVizinho(mes, -1)}`} aria-label="Mês anterior" className="rounded-lg p-1.5 text-navy hover:bg-navy-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Link>
            <span className="min-w-[8.5rem] text-center font-display text-sm font-semibold text-navy">
              {MESES[mesNum - 1]} {ano}
            </span>
            <Link href={`?mes=${mesVizinho(mes, 1)}`} aria-label="Próximo mês" className="rounded-lg p-1.5 text-navy hover:bg-navy-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <a
            href={`/api/flash/consolidado/excel?mes=${mes}`}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-inhaus-grad px-4 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
          >
            <Download className="h-4 w-4" aria-hidden /> Exportar Excel
          </a>
        </div>
      </section>

      {erro && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Envios da semana">
        <div className="reveal delay-1 rounded-3xl bg-inhaus-grad p-5 text-white shadow-glow">
          <p className="text-xs text-white/75">Envios · Semana {semanaRef}</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
            {enviados.length} <span className="text-lg font-normal text-white/70">de {linhas.length} PECs</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="PECs enviados">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-3 text-sm text-white/80">
            Receita líquida projetada: <strong className="text-white">{total(soma(linhas, liquidaSemana(semanaRef)))}</strong>
          </p>
        </div>
        <div className="glass reveal delay-2 rounded-3xl p-5 lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pendentes na semana {semanaRef}</p>
          {pendentes.length === 0 ? (
            <p className="mt-3 text-sm text-teal-deep">Todos os PECs enviaram. O consolidado está pronto para exportar.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {pendentes.map((l) => (
                <li key={l.pec.pecCod} className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900">
                  <span className="font-medium">{tituloNome(nomeDoPec(l.pec.pecNome))}</span>
                  <span className="text-amber-800/80">{l.pec.gerente ? tituloNome(l.pec.gerente) : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {linhas.length === 0 && !erro ? (
        <p className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">Nenhum PEC participa do Flash Report ainda.</p>
      ) : (
        <div className="glass reveal delay-3 overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[56rem] text-sm">
            <caption className="sr-only">Receita líquida projetada por PEC e semana — {MESES[mesNum - 1]} {ano}</caption>
            <thead className="sticky top-0 bg-white/90 backdrop-blur">
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="px-5 py-3 text-left font-medium">PEC</th>
                {semanas.map((n) => (
                  <th key={n} scope="col" className={cn("px-3 py-3 text-right font-medium", n === semanaRef && "text-navy")}>
                    Semana {n}
                  </th>
                ))}
                <th scope="col" className="px-5 py-3 text-right font-medium">Realizado</th>
              </tr>
            </thead>
            {[...porGerente.entries()].map(([gerente, doGerente]) => (
              <tbody key={gerente}>
                <tr className="border-t border-navy/10 bg-navy-mist/70">
                  <th scope="rowgroup" className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider text-navy">
                    {tituloNome(gerente)}
                  </th>
                  {semanas.map((n) => (
                    <td key={n} className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-navy">
                      {total(soma(doGerente, liquidaSemana(n)))}
                    </td>
                  ))}
                  <td className="px-5 py-2 text-right text-xs font-semibold tabular-nums text-navy">{total(soma(doGerente, (l) => l.realizadoRol))}</td>
                </tr>
                {doGerente.map((l) => (
                  <tr key={l.pec.pecCod} className="border-t border-navy/5">
                    <th scope="row" className="px-5 py-2.5 text-left font-normal">
                      <Link
                        href={`/dashboards/financeiro/flash-report/${l.pec.pecCod}?mes=${mes}&semana=${semanaRef}`}
                        className="text-navy hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                      >
                        {tituloNome(nomeDoPec(l.pec.pecNome))}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        PEC {l.pec.pecCod} · CR {l.pec.crCod}
                      </span>
                    </th>
                    {semanas.map((n) => {
                      const s = l.semanas[n]
                      return (
                        <td key={n} className="px-3 py-2.5 text-right align-top">
                          {s ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="tabular-nums text-navy">{moeda(s.receitaLiquida)}</span>
                              <span className="inline-flex items-center gap-1">
                                <SeloStatus status={s.status} className="px-2 text-[0.68rem]" />
                                {s.status === "ENVIADO" && (
                                  <ReabrirSemana pecCod={l.pec.pecCod} mes={mes} semana={n} rotulo={tituloNome(nomeDoPec(l.pec.pecNome))} />
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground" aria-label="Pendente">
                              —
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-5 py-2.5 text-right align-top tabular-nums text-navy">
                      {l.realizadoRol == null ? <span className="text-muted-foreground">—</span> : moeda(l.realizadoRol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tfoot>
              <tr className="border-t-2 border-navy/15">
                <th scope="row" className="px-5 py-3 text-left font-display font-semibold text-navy">
                  Total
                </th>
                {semanas.map((n) => (
                  <td key={n} className="px-3 py-3 text-right font-display font-semibold tabular-nums text-navy">
                    {total(soma(linhas, liquidaSemana(n)))}
                  </td>
                ))}
                <td className="px-5 py-3 text-right font-display font-semibold tabular-nums text-navy">{total(soma(linhas, (l) => l.realizadoRol))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
