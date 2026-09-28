import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ChevronLeft, ChevronRight, Settings2 } from "lucide-react"

import { FlashInfo } from "@/components/flash/FlashInfo"
import { GradeLancamento } from "@/components/flash/GradeLancamento"
import { moeda, nomeDoPec, variacaoMoeda } from "@/components/flash/moeda"
import { Parametrizacao } from "@/components/flash/Parametrizacao"
import { SeloStatus } from "@/components/flash/SeloStatus"
import { assertTelaVisivel } from "@/lib/dashboard-acesso"
import { escopoDaPagina, TELA_FLASH } from "@/lib/flash/acesso"
import { abrirSemana, contasDre, ErroFlash, garantirPecNoEscopo, listarItens, type SemanaCompleta } from "@/lib/flash/dados"
import { semanaDoMes, semanasDoMes, type Periodo } from "@/lib/flash/semanas"
import { periodoSchema } from "@/lib/flash/validacao"
import { tituloNome } from "@/lib/nomes"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Flash Report · PEC" }
export const dynamic = "force-dynamic"

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

function mesVizinho(mes: string, passo: number): string {
  const [a, m] = mes.split("-").map(Number)
  const d = new Date(Date.UTC(a, m - 1 + passo, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export default async function PecFlashPage({
  params,
  searchParams,
}: {
  params: { pec: string }
  searchParams: Record<string, string | string[] | undefined>
}) {
  await assertTelaVisivel(TELA_FLASH)
  const escopo = await escopoDaPagina()
  const lido = periodoSchema.safeParse({ mes: searchParams.mes, semana: searchParams.semana })
  const periodo: Periodo = lido.success && semanasDoMes(lido.data.mes).includes(lido.data.semana) ? lido.data : semanaDoMes(new Date())
  const aba = searchParams.aba === "parametrizacao" ? "parametrizacao" : "lancamento"
  const base = `/dashboards/financeiro/flash-report/${params.pec}`
  const link = (p: Periodo, a = aba) => `${base}?mes=${p.mes}&semana=${p.semana}&aba=${a}`

  let pec
  try {
    pec = await garantirPecNoEscopo(escopo, params.pec)
  } catch (e) {
    if (e instanceof ErroFlash && e.status === 404) notFound()
    throw e
  }

  let semana: SemanaCompleta | null = null
  let erro: string | null = null
  const itens = await listarItens(escopo, pec.pecCod)
  const contas = aba === "parametrizacao" ? await contasDre() : []
  if (aba === "lancamento" && itens.some((i) => i.ativo)) {
    try {
      semana = await abrirSemana(escopo, pec.pecCod, periodo)
    } catch (e) {
      erro = e instanceof Error ? e.message : "Falha ao abrir a semana."
    }
  }
  const [ano, mesNum] = periodo.mes.split("-").map(Number)
  const variacao = semana && semana.liquidaAnterior != null ? semana.receitaLiquida - semana.liquidaAnterior : null

  return (
    <div className="space-y-6">
      <section className="reveal">
        <nav aria-label="Caminho" className="text-xs text-muted-foreground">
          <Link href="/dashboards/financeiro/flash-report" className="hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
            Flash Report
          </Link>{" "}
          › PEC {pec.pecCod}
        </nav>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-navy">{tituloNome(nomeDoPec(pec.pecNome))}</h1>
          <FlashInfo />
          {semana && <SeloStatus status={semana.status} />}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          PEC {pec.pecCod} · CR {pec.crCod}
          {pec.gerente && <> · {tituloNome(pec.gerente)}</>}
        </p>
      </section>

      <section className="reveal delay-1 flex flex-wrap items-center gap-3" aria-label="Semana">
        <div className="flex items-center gap-1">
          <Link
            href={link({ mes: mesVizinho(periodo.mes, -1), semana: 1 })}
            aria-label="Mês anterior"
            className="rounded-lg p-1.5 text-navy hover:bg-navy-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <span className="min-w-[8.5rem] text-center font-display text-sm font-semibold text-navy">
            {MESES[mesNum - 1]} {ano}
          </span>
          <Link
            href={link({ mes: mesVizinho(periodo.mes, 1), semana: 1 })}
            aria-label="Próximo mês"
            className="rounded-lg p-1.5 text-navy hover:bg-navy-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="flex rounded-2xl border border-navy/10 bg-white/70 p-1">
          {semanasDoMes(periodo.mes).map((n) => {
            const ativa = n === periodo.semana
            return (
              <Link
                key={n}
                href={link({ mes: periodo.mes, semana: n })}
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
      </section>

      {aba === "lancamento" && semana && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo da projeção">
          {[
            { rotulo: "Receita bruta", valor: moeda(semana.receitaBruta), destaque: false },
            { rotulo: "Receita líquida", valor: moeda(semana.receitaLiquida), destaque: true, nota: `Impostos ${(semana.aliquota * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` },
            {
              rotulo: "Vs. semana anterior",
              valor: variacao == null ? "—" : variacaoMoeda(variacao),
              cor: variacao == null ? "" : variacao >= 0 ? "text-emerald-700" : "text-red-700",
              nota: variacao == null ? "Sem semana enviada antes" : "Receita líquida",
            },
            {
              rotulo: semana.realizadoUltimoMes ? `Realizado ${semana.realizadoUltimoMes.mes.split("-").reverse().join("/")}` : "Realizado",
              valor: semana.realizadoUltimoMes ? moeda(semana.realizadoUltimoMes.rol) : "—",
              nota: "Receita líquida do último mês fechado",
            },
          ].map((k, i) => (
            <div key={k.rotulo} className={cn("reveal rounded-3xl p-4", `delay-${i + 1}`, k.destaque ? "bg-inhaus-grad text-white shadow-glow" : "glass")}>
              <p className={cn("text-xs", k.destaque ? "text-white/75" : "text-muted-foreground")}>{k.rotulo}</p>
              <p className={cn("mt-1 font-display text-xl font-semibold tabular-nums sm:text-2xl", k.destaque ? "text-white" : k.cor || "text-navy")}>{k.valor}</p>
              {k.nota && <p className={cn("mt-0.5 text-xs", k.destaque ? "text-white/70" : "text-muted-foreground")}>{k.nota}</p>}
            </div>
          ))}
        </section>
      )}

      <nav aria-label="Seções do PEC" className="flex gap-1 border-b border-navy/10">
        {[
          { chave: "lancamento", rotulo: "Lançamento" },
          { chave: "parametrizacao", rotulo: `Parametrização (${itens.filter((i) => i.ativo).length})` },
        ].map((t) => (
          <Link
            key={t.chave}
            href={link(periodo, t.chave)}
            aria-current={aba === t.chave ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
              aba === t.chave ? "border-teal text-navy" : "border-transparent text-muted-foreground hover:text-navy",
            )}
          >
            {t.rotulo}
          </Link>
        ))}
      </nav>

      {erro && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </div>
      )}

      {aba === "parametrizacao" ? (
        <Parametrizacao pecCod={pec.pecCod} itens={itens} contas={contas} />
      ) : semana ? (
        <GradeLancamento
          key={`${semana.id}-${semana.status}-${semana.linhas.map((l) => l.itemId).join(",")}`}
          semana={semana}
          url={`/api/flash/pecs/${pec.pecCod}/semanas/${periodo.mes}/${periodo.semana}`}
        />
      ) : (
        !erro && (
          <div className="glass rounded-3xl p-8 text-center">
            <Settings2 className="mx-auto h-8 w-8 text-teal" aria-hidden />
            <p className="mt-3 font-display text-lg font-semibold text-navy">Configure o contrato primeiro</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre os itens cobrados deste PEC (funções, hora extra, variáveis, descontos). Depois, toda semana, você só ajusta as quantidades.
            </p>
            <Link
              href={link(periodo, "parametrizacao")}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-inhaus-grad px-5 text-sm font-semibold text-white shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              Ir para a parametrização
            </Link>
          </div>
        )
      )}
    </div>
  )
}
