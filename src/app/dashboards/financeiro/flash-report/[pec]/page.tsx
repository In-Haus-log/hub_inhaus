import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AlertTriangle, ChevronLeft, ChevronRight, Settings2 } from "lucide-react"

import { FlashInfo } from "@/components/flash/FlashInfo"
import { GradeLancamento } from "@/components/flash/GradeLancamento"
import { moeda, nomeDoPec, percentual, variacaoMoeda } from "@/components/flash/moeda"
import { SeloStatus } from "@/components/flash/SeloStatus"
import { assertTelaVisivel } from "@/lib/dashboard-acesso"
import { escopoDaPagina, TELA_FLASH } from "@/lib/flash/acesso"
import { resumoSemana } from "@/lib/flash/calculos"
import { abrirSemana, ErroFlash, garantirPecNoEscopo, listarItens, type SemanaCompleta } from "@/lib/flash/dados"
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
  // A parametrização agora vive em Projeções; o endereço antigo da aba só redireciona.
  if (searchParams.aba === "parametrizacao") {
    redirect(`/dashboards/financeiro/projecoes/${encodeURIComponent(params.pec)}?mes=${periodo.mes}&semana=${periodo.semana}`)
  }
  const base = `/dashboards/financeiro/flash-report/${params.pec}`
  const link = (p: Periodo) => `${base}?mes=${p.mes}&semana=${p.semana}`

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
  if (itens.some((i) => i.ativo)) {
    try {
      semana = await abrirSemana(escopo, pec.pecCod, periodo)
    } catch (e) {
      erro = e instanceof Error ? e.message : "Falha ao abrir a semana."
    }
  }
  const urlParametrizacao = `/dashboards/financeiro/projecoes/${pec.pecCod}?mes=${periodo.mes}&semana=${periodo.semana}`
  const [ano, mesNum] = periodo.mes.split("-").map(Number)
  const r = semana ? resumoSemana(semana.itens, semana.linhas, semana.aliquota) : null
  // Variação sobre o ROL do escopo do usuário (mesma base da grade e da semana anterior).
  const variacao = semana && r && semana.liquidaAnterior != null ? r.rol - semana.liquidaAnterior : null

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
        <Link
          href={urlParametrizacao}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-navy/10 bg-white/70 px-4 text-sm font-medium text-navy transition hover:border-teal/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <Settings2 className="h-4 w-4 text-teal" aria-hidden /> Parametrização ({itens.filter((i) => i.ativo).length})
        </Link>
      </section>

      {semana && r && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6" aria-label="Resumo da projeção">
          {[
            { rotulo: "Receita bruta", valor: moeda(r.bruta), destaque: false, cor: "", nota: "" },
            {
              rotulo: "ROL",
              valor: moeda(r.rol),
              destaque: true,
              cor: "",
              nota: `Impostos ${(semana.aliquota * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
            },
            { rotulo: "Custos", valor: moeda(r.custos), destaque: false, cor: "", nota: "" },
            { rotulo: "MC", valor: moeda(r.mc), destaque: false, cor: r.mc < 0 ? "text-red-700" : "", nota: `Margem ${percentual(r.margem)}` },
            {
              rotulo: "Vs. semana anterior",
              valor: variacao == null ? "—" : variacaoMoeda(variacao),
              destaque: false,
              cor: variacao == null ? "" : variacao >= 0 ? "text-emerald-700" : "text-red-700",
              nota: variacao == null ? "Sem semana enviada antes" : "ROL",
            },
            {
              rotulo: semana.realizadoUltimoMes ? `Realizado ${semana.realizadoUltimoMes.mes.split("-").reverse().join("/")}` : "Realizado",
              valor: semana.realizadoUltimoMes ? moeda(semana.realizadoUltimoMes.rol) : "—",
              destaque: false,
              cor: "",
              nota: "ROL do último mês fechado",
            },
          ].map((k, i) => (
            <div key={k.rotulo} className={cn("reveal rounded-3xl p-4", `delay-${Math.min(i + 1, 5)}`, k.destaque ? "bg-inhaus-grad text-white shadow-glow" : "glass")}>
              <p className={cn("text-xs", k.destaque ? "text-white/75" : "text-muted-foreground")}>{k.rotulo}</p>
              <p className={cn("mt-1 font-display text-xl font-semibold tabular-nums sm:text-2xl", k.destaque ? "text-white" : k.cor || "text-navy")}>{k.valor}</p>
              {k.nota && <p className={cn("mt-0.5 text-xs", k.destaque ? "text-white/70" : "text-muted-foreground")}>{k.nota}</p>}
            </div>
          ))}
        </section>
      )}

      {erro && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </div>
      )}

      {semana ? (
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
              href={urlParametrizacao}
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
