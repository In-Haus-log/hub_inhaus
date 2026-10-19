"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import type { DashboardGps, FiltrosGps, OpcoesGps } from "@/lib/absenteismo-gps"

type Props = { dados: DashboardGps; opcoes: OpcoesGps; filtros: FiltrosGps }
type CampoOrdenacao = "nome" | "injustificado" | "justificado" | "geral"

const fmtNumero = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtInteiro = new Intl.NumberFormat("pt-BR")
const fmtPct = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtMes = (mes: string) => {
  const [ano, numero] = mes.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(ano, numero - 1, 1))).replace(" de ", "/")
}

export function PainelAbsenteismo({ dados, opcoes, filtros }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filtroLocal, setFiltroLocal] = useState<FiltrosGps>(() => ({ ...filtros }))
  const [busca, setBusca] = useState("")
  const [ordenacao, setOrdenacao] = useState<{ campo: CampoOrdenacao; direcao: "asc" | "desc" }>({ campo: "injustificado", direcao: "desc" })
  const [pagina, setPagina] = useState(1)
  const [isPending, startTransition] = useTransition()

  useEffect(() => setFiltroLocal({ ...filtros }), [filtros.mes, filtros.gerente, filtros.cr])

  function alterarFiltro(campo: keyof FiltrosGps, valor: string) {
    const atualizado = { ...filtroLocal, [campo]: valor }
    setFiltroLocal(atualizado)
    setPagina(1)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("ger")
    for (const chave of ["mes", "gerente", "cr"] as const) {
      const valorAtual = atualizado[chave]
      if (valorAtual) params.set(chave, valorAtual)
      else params.delete(chave)
    }
    const query = params.toString()
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR")
    return dados.colaboradores.filter((pessoa) => !termo || [pessoa.nome, pessoa.gerente, pessoa.crCodigo, pessoa.crNome]
      .some((valor) => (valor ?? "").toLocaleLowerCase("pt-BR").includes(termo)))
  }, [dados.colaboradores, busca])

  const ordenados = useMemo(() => [...filtrados].sort((a, b) => {
    const av = a[ordenacao.campo]
    const bv = b[ordenacao.campo]
    if (av == null) return bv == null ? 0 : 1
    if (bv == null) return -1
    const resultado = ordenacao.campo === "nome"
      ? String(av ?? "").localeCompare(String(bv ?? ""), "pt-BR")
      : (Number(av) || 0) - (Number(bv) || 0)
    return resultado * (ordenacao.direcao === "asc" ? 1 : -1)
  }), [filtrados, ordenacao])
  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / 25))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = ordenados.slice((paginaAtual - 1) * 25, paginaAtual * 25)

  function ordenar(campo: CampoOrdenacao) {
    setOrdenacao((atual) => ({ campo, direcao: atual.campo === campo && atual.direcao === "desc" ? "asc" : "desc" }))
    setPagina(1)
  }

  const indicadores = [
    { chave: "geral" as const, rotulo: "Absenteísmo geral", valor: dados.atual.geral, anterior: dados.anterior?.geral, destaque: true },
    { chave: "injustificado" as const, rotulo: "Injustificado", valor: dados.atual.injustificado, anterior: dados.anterior?.injustificado },
    { chave: "justificado" as const, rotulo: "Justificado", valor: dados.atual.justificado, anterior: dados.anterior?.justificado },
  ]

  return <div className="min-w-0 space-y-5" aria-busy={isPending}>
    <section aria-label="Filtros do painel" className="flex flex-wrap items-end gap-3 rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
      <Filtro label="Mês de referência" value={filtroLocal.mes} options={opcoes.meses.map((mes) => [mes, fmtMes(mes)])} onChange={(v) => alterarFiltro("mes", v)} todos={false} />
      <Filtro label="Gerente" value={filtroLocal.gerente ?? ""} options={opcoes.gerentes.map((v) => [v, v])} onChange={(v) => alterarFiltro("gerente", v)} />
      <Filtro label="Centro de resultado" value={filtroLocal.cr ?? ""} options={opcoes.crs.map((cr) => [cr.codigo, `${cr.codigo} · ${nomeCr(cr.codigo, cr.nome)}`])} onChange={(v) => alterarFiltro("cr", v)} />
      {isPending && <span role="status" className="pb-2 text-xs text-muted-foreground">Atualizando painel…</span>}
    </section>

    <section aria-label="Indicadores de absenteísmo" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
      {indicadores.map((item) => <article key={item.chave} className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${item.destaque ? "border-navy bg-navy text-white shadow-card" : "border-navy/10 bg-white text-navy shadow-sm"}`}>
        <p className={`text-sm font-medium ${item.destaque ? "text-white/75" : "text-muted-foreground"}`}>{item.rotulo}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <strong className="text-3xl font-semibold tabular-nums tracking-tight">{formatarPercentual(item.valor)}</strong>
          <Variacao atual={item.valor} anterior={item.anterior} mesAnterior={dados.mesAnterior} escura={!!item.destaque} />
        </div>
      </article>)}
    </section>

    <section aria-labelledby="evolucao-gps" className="min-w-0 rounded-2xl border border-navy/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h2 id="evolucao-gps" className="text-base font-semibold text-navy">Evolução mensal</h2><p className="mt-1 text-xs text-muted-foreground">Percentuais sobre a base salarial</p></div>
        <span className="text-xs text-muted-foreground">{dados.evolucao.length} meses</span>
      </div>
      {dados.evolucao.length ? <>
        <div className="mt-4 h-72 min-w-0" role="img" aria-label="Gráfico de barras agrupadas com absenteísmo geral, injustificado e justificado por mês">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={dados.evolucao.map((ponto) => ({ ...ponto, mesLabel: fmtMes(ponto.mes) }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `${fmtNumero.format(Number(v))}%`} />
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.mes ? fmtMes(payload[0].payload.mes) : ""} formatter={(v, nome) => [v == null ? "Sem base salarial" : formatarPercentual(Number(v)), nome]} contentStyle={{ borderRadius: 10, borderColor: "hsl(var(--border))", fontSize: 12 }} />
            <Bar dataKey="geral" name="Geral" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="injustificado" name="Injustificado" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="justificado" name="Justificado" fill="color-mix(in srgb, hsl(var(--accent)) 45%, hsl(var(--background)))" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart></ResponsiveContainer>
        </div>
        <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Legenda do gráfico">
          <Legenda cor="hsl(var(--primary))" texto="Geral" /><Legenda cor="hsl(var(--accent))" texto="Injustificado" /><Legenda cor="color-mix(in srgb, hsl(var(--accent)) 45%, hsl(var(--background)))" texto="Justificado" />
        </ul>
        <details className="mt-3 border-t border-border pt-3">
          <summary className="w-fit cursor-pointer rounded-sm text-xs font-medium text-teal hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">Consultar valores mensais</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <caption className="sr-only">Valores mensais de absenteísmo em percentual da base salarial</caption>
              <thead><tr className="text-muted-foreground"><th scope="col" className="px-2 py-2">Mês</th><th scope="col" className="px-2 py-2 text-right">Geral</th><th scope="col" className="px-2 py-2 text-right">Injustificado</th><th scope="col" className="px-2 py-2 text-right">Justificado</th></tr></thead>
              <tbody className="divide-y divide-border">{dados.evolucao.map((ponto) => <tr key={ponto.mes}><th scope="row" className="px-2 py-2 font-medium text-navy">{fmtMes(ponto.mes)}</th><td className="px-2 py-2 text-right tabular-nums">{formatarPercentual(ponto.geral)}</td><td className="px-2 py-2 text-right tabular-nums">{formatarPercentual(ponto.injustificado)}</td><td className="px-2 py-2 text-right tabular-nums">{formatarPercentual(ponto.justificado)}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </> : <Vazio>Sem histórico disponível para este recorte.</Vazio>}
    </section>

    <section aria-labelledby="detalhe-colaboradores" className="min-w-0 overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div><h2 id="detalhe-colaboradores" className="text-base font-semibold text-navy">Detalhamento por colaborador</h2><p className="mt-1 text-xs text-muted-foreground">{fmtInteiro.format(dados.atual.colaboradores)} pessoas · {fmtInteiro.format(ordenados.length)} vínculos</p></div>
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Buscar colaborador, gerente ou centro de resultado</span>
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1) }} placeholder="Buscar nome, gerente ou CR" className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal" />
          {busca && <button type="button" onClick={() => { setBusca(""); setPagina(1) }} aria-label="Limpar busca" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"><X className="h-4 w-4" /></button>}
        </label>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-secondary/70 text-xs font-semibold text-muted-foreground">
            <tr><th scope="col" aria-sort={valorAriaOrdenacao(ordenacao, "nome")} className="px-4 py-3 sm:px-5"><BotaoOrdenacao campo="nome" rotulo="Colaborador" atual={ordenacao} onClick={ordenar} /></th><th scope="col" className="px-3 py-3">Gerente</th><th scope="col" className="px-3 py-3">Centro de resultado</th><th scope="col" aria-sort={valorAriaOrdenacao(ordenacao, "injustificado")} className="px-3 py-3 text-right"><BotaoOrdenacao campo="injustificado" rotulo="Injustificado" atual={ordenacao} onClick={ordenar} /></th><th scope="col" aria-sort={valorAriaOrdenacao(ordenacao, "justificado")} className="px-3 py-3 text-right"><BotaoOrdenacao campo="justificado" rotulo="Justificado" atual={ordenacao} onClick={ordenar} /></th><th scope="col" aria-sort={valorAriaOrdenacao(ordenacao, "geral")} className="px-4 py-3 text-right sm:px-5"><BotaoOrdenacao campo="geral" rotulo="Geral" atual={ordenacao} onClick={ordenar} /></th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visiveis.map((pessoa) => <tr key={pessoa.id} className="transition-colors hover:bg-secondary/50">
              <th scope="row" className="max-w-[220px] truncate px-4 py-3.5 font-medium text-navy sm:px-5" title={pessoa.nome}>{pessoa.nome}</th>
              <td className="max-w-[180px] truncate px-3 py-3.5 text-muted-foreground" title={pessoa.gerente}>{pessoa.gerente || "—"}</td>
              <td className="max-w-[190px] truncate px-3 py-3.5 text-muted-foreground" title={nomeCr(pessoa.crCodigo, pessoa.crNome)}>{pessoa.crCodigo ? `${pessoa.crCodigo} · ` : ""}{nomeCr(pessoa.crCodigo, pessoa.crNome) || "—"}</td>
              <td className="px-3 py-3.5 text-right font-medium tabular-nums text-navy">{formatarPercentual(pessoa.injustificado)}</td>
              <td className="px-3 py-3.5 text-right font-medium tabular-nums text-navy">{formatarPercentual(pessoa.justificado)}</td>
              <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-navy sm:px-5">{formatarPercentual(pessoa.geral)}</td>
            </tr>)}
            {!visiveis.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">{dados.colaboradores.length ? "Nenhum colaborador corresponde à busca." : "Não há colaboradores neste recorte."}</td></tr>}
          </tbody>
        </table>
      </div>
      {ordenados.length > 25 && <nav aria-label="Paginação de colaboradores" className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-5">
        <span className="text-xs tabular-nums text-muted-foreground">{(paginaAtual - 1) * 25 + 1}–{Math.min(paginaAtual * 25, ordenados.length)} de {ordenados.length}</span>
        <div className="flex items-center gap-2"><button type="button" aria-label="Página anterior" disabled={paginaAtual <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-navy hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">{paginaAtual} / {totalPaginas}</span><button type="button" aria-label="Próxima página" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-navy hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"><ChevronRight className="h-4 w-4" /></button></div>
      </nav>}
    </section>
  </div>
}

function formatarPercentual(valor: number | null | undefined) { return valor == null ? "—" : fmtPct.format(valor / 100) }

function Variacao({ atual, anterior, mesAnterior, escura }: { atual: number | null; anterior?: number | null; mesAnterior: string; escura: boolean }) {
  if (atual == null) return <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${escura ? "bg-white/10 text-white/70" : "bg-muted text-muted-foreground"}`}>Sem base salarial</span>
  if (anterior == null) return <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${escura ? "bg-white/10 text-white/70" : "bg-muted text-muted-foreground"}`}>Sem dados no mês anterior</span>
  const delta = atual - anterior
  const melhor = delta < 0
  const cor = delta === 0 ? (escura ? "bg-white/10 text-white/75" : "bg-muted text-muted-foreground") : melhor ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
  const sinal = delta > 0 ? "+" : ""
  return <div className="flex flex-col items-end gap-1">
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums ${cor}`}>
      {delta > 0 ? <ArrowUp aria-hidden="true" className="h-3 w-3" /> : delta < 0 ? <ArrowDown aria-hidden="true" className="h-3 w-3" /> : null}
      {delta === 0 ? "0,00 p.p." : `${sinal}${fmtNumero.format(delta)} p.p.`}
    </span>
    <span className={`whitespace-nowrap text-[10px] tabular-nums ${escura ? "text-white/65" : "text-muted-foreground"}`}>{fmtMes(mesAnterior)} · {formatarPercentual(anterior)}</span>
  </div>
}

function Filtro({ label, value, options, onChange, todos = true }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; todos?: boolean }) {
  return <label className="block w-full min-w-0 text-xs font-medium text-navy sm:w-auto sm:min-w-[170px] sm:flex-1">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">{todos && <option value="">Todos</option>}{options.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}</select></label>
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return <li className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cor }} />{texto}</li>
}

function BotaoOrdenacao({ campo, rotulo, atual, onClick }: { campo: CampoOrdenacao; rotulo: string; atual: { campo: CampoOrdenacao; direcao: "asc" | "desc" }; onClick: (campo: CampoOrdenacao) => void }) {
  const selecionado = atual.campo === campo
  return <button type="button" onClick={() => onClick(campo)} aria-label={`Ordenar por ${rotulo}`} className="inline-flex items-center justify-end gap-1 rounded-sm text-inherit hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">{rotulo}{selecionado && (atual.direcao === "asc" ? <ArrowUp aria-hidden="true" className="h-3 w-3" /> : <ArrowDown aria-hidden="true" className="h-3 w-3" />)}</button>
}

function valorAriaOrdenacao(atual: { campo: CampoOrdenacao; direcao: "asc" | "desc" }, campo: CampoOrdenacao): "ascending" | "descending" | "none" {
  return atual.campo === campo ? (atual.direcao === "asc" ? "ascending" : "descending") : "none"
}

function nomeCr(codigo: string, nome: string) {
  if (!codigo.trim()) return nome.trim()
  const prefixo = new RegExp(`^${codigo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:[-–·:]\\s*)?`)
  return nome.trim().replace(prefixo, "")
}

function Vazio({ children }: { children: React.ReactNode }) { return <p role="status" className="py-12 text-center text-sm text-muted-foreground">{children}</p> }

