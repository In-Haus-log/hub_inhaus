import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarCheck } from "lucide-react"

import { moeda, nomeDoPec } from "@/components/flash/moeda"
import { ParametrizacaoInfo } from "@/components/projecoes/ParametrizacaoInfo"
import { ParametrizacaoPec } from "@/components/projecoes/ParametrizacaoPec"
import { assertTelaVisivel } from "@/lib/dashboard-acesso"
import { escopoDaPagina, TELA_FLASH } from "@/lib/flash/acesso"
import { crsDoEscopo, ErroFlash, garantirPecNoEscopo, listarItens } from "@/lib/flash/dados"
import { valorLinha, type Natureza } from "@/lib/flash/calculos"
import { tituloNome } from "@/lib/nomes"

export const metadata: Metadata = { title: "Projeções · Parametrização do PEC" }
export const dynamic = "force-dynamic"

export default async function ParametrizacaoPecPage({
  params,
  searchParams,
}: {
  params: { pec: string }
  searchParams: Record<string, string | string[] | undefined>
}) {
  await assertTelaVisivel(TELA_FLASH)
  const escopo = await escopoDaPagina()

  let pec
  try {
    pec = await garantirPecNoEscopo(escopo, params.pec)
  } catch (e) {
    if (e instanceof ErroFlash && e.status === 404) notFound()
    throw e
  }
  const [itens, crs] = await Promise.all([listarItens(escopo, pec.pecCod), crsDoEscopo(escopo)])

  const mes = typeof searchParams.mes === "string" ? searchParams.mes : null
  const semana = typeof searchParams.semana === "string" ? searchParams.semana : null
  const voltar = `/dashboards/financeiro/projecoes${mes && semana ? `?mes=${encodeURIComponent(mes)}&semana=${encodeURIComponent(semana)}` : ""}`
  const lancar = `/dashboards/financeiro/flash-report/${pec.pecCod}${mes && semana ? `?mes=${encodeURIComponent(mes)}&semana=${encodeURIComponent(semana)}` : ""}`
  const ativos = itens.filter((i) => i.ativo)
  const somaMes = (natureza: Natureza) => ativos.filter((i) => i.natureza === natureza).reduce((s, i) => s + valorLinha(i.tipo, i.valorUnitario, i.qtdPadrao), 0)
  const receitaMes = somaMes("RECEITA")
  const custoMes = somaMes("CUSTO")

  return (
    <div className="space-y-6">
      <section className="reveal">
        <nav aria-label="Caminho" className="text-xs text-muted-foreground">
          <Link href={voltar} className="hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
            Projeções
          </Link>{" "}
          › PEC {pec.pecCod}
        </nav>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-navy">{tituloNome(nomeDoPec(pec.pecNome))}</h1>
          <ParametrizacaoInfo />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          PEC {pec.pecCod} · CR padrão {pec.crCod}
        </p>
      </section>

      <section className="reveal delay-1 grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Resumo do cadastro">
        <div className="glass rounded-3xl p-4">
          <p className="text-xs text-muted-foreground">Itens ativos</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-navy">{ativos.length}</p>
        </div>
        <div className="glass rounded-3xl p-4">
          <p className="text-xs text-muted-foreground">Receita padrão do mês</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-navy">{moeda(receitaMes)}</p>
        </div>
        <div className="glass col-span-2 rounded-3xl p-4 lg:col-span-1">
          <p className="text-xs text-muted-foreground">Custo padrão do mês</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-navy">{moeda(custoMes)}</p>
        </div>
      </section>

      <div className="flex justify-end">
        <Link
          href={lancar}
          className="inline-flex items-center gap-2 rounded-xl border border-navy/10 bg-white/70 px-4 py-2 text-sm font-medium text-navy transition hover:-translate-y-0.5 hover:border-teal/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <CalendarCheck className="h-4 w-4 text-teal" aria-hidden /> Lançar a semana
        </Link>
      </div>

      <ParametrizacaoPec pecCod={pec.pecCod} crPadrao={pec.crCod} itens={itens} crs={crs} />
    </div>
  )
}
