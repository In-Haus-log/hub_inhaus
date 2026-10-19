"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Building2, ChevronDown, ClipboardList, ExternalLink, Filter, Users, X } from "lucide-react"
import { TYPES_OCORRENCIA, type DadosConformidadeLegal } from "@/lib/conformidade-legal-modelo"
import { linkConformidade, type FiltrosConformidade } from "@/lib/conformidade-legal-filtros"
import { tituloNome } from "@/lib/nomes"

type ChaveOcorrencia = (typeof TYPES_OCORRENCIA)[number]["key"]
type Recorte = Omit<FiltrosConformidade, "tipo">

const CORES = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--foreground))", "hsl(var(--muted-foreground))", "hsl(var(--ring))", "hsl(var(--secondary-foreground))"]
const fmtNumero = new Intl.NumberFormat("pt-BR")
const fmtPercentual = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })
const fmtMes = (mes: string) => {
  const [ano, numero] = mes.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(ano, numero - 1, 1))).replace(" de ", "/")
}
const nome = (valor: string | null | undefined) => valor ? tituloNome(valor) : "Não informado"
const nomeCr = (cr: string | null, descricao: string | null) => {
  const textoCr = descricao?.trim() || "Não informado"
  if (!cr) return textoCr
  const prefixo = new RegExp(`^${cr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:[-–·:]\\s*)?`)
  return textoCr.replace(prefixo, "") || textoCr
}

export function DashboardConformidadeLegal({ dados, filtrosIniciais }: { dados: DadosConformidadeLegal; filtrosIniciais: FiltrosConformidade }) {
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [recorte, setRecorte] = useState<Recorte>(() => ({
    mes: filtrosIniciais?.mes ?? "", cr: filtrosIniciais?.cr ?? "", gerente: filtrosIniciais?.gerente ?? "",
    funcao: filtrosIniciais?.funcao ?? "", regional: filtrosIniciais?.regional ?? "", supervisor: filtrosIniciais?.supervisor ?? "",
  }))
  const [tipoAtivo, setTipoAtivo] = useState<ChaveOcorrencia | null>(() =>
    TYPES_OCORRENCIA.some((tipo) => tipo.key === filtrosIniciais?.tipo) ? filtrosIniciais!.tipo as ChaveOcorrencia : null,
  )
  const filtrosAtuais: FiltrosConformidade = { ...recorte, tipo: tipoAtivo ?? "" }

  const opcoes = useMemo(() => ({
    mes: unicos(dados.linhas.map((l) => l.mes)).sort().reverse(),
    cr: [...new Set(dados.linhas.filter((l) => l.cr).map((l) => l.cr!))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    regional: unicos(dados.linhas.map((l) => l.regional)).sort((a, b) => a.localeCompare(b, "pt-BR")),
    gerente: unicos(dados.linhas.map((l) => l.gerente)).sort((a, b) => a.localeCompare(b, "pt-BR")),
    supervisor: unicos(dados.linhas.map((l) => l.supervisor)).sort((a, b) => a.localeCompare(b, "pt-BR")),
    funcao: unicos(dados.linhas.map((l) => l.funcao)).sort((a, b) => a.localeCompare(b, "pt-BR")),
  }), [dados.linhas])

  const linhasRecorte = useMemo(() => dados.linhas.filter((l) =>
    (!recorte.mes || l.mes === recorte.mes) && (!recorte.cr || l.cr === recorte.cr) &&
    (!recorte.regional || l.regional === recorte.regional) && (!recorte.gerente || l.gerente === recorte.gerente) &&
    (!recorte.supervisor || l.supervisor === recorte.supervisor) && (!recorte.funcao || l.funcao === recorte.funcao),
  ), [dados.linhas, recorte])
  const totais = useMemo(() => TYPES_OCORRENCIA.map((tipo, i) => ({
    ...tipo, cor: CORES[i % CORES.length], valor: linhasRecorte.reduce((soma, l) => soma + (Number(l[tipo.key]) || 0), 0),
  })), [linhasRecorte])
  const totalOcorrencias = linhasRecorte.reduce((soma, l) => soma + (Number(l.total) || 0), 0)
  const pessoas = new Set(linhasRecorte.filter((l) => (l.total ?? 0) > 0).map((l) => l.pessoaId).filter(Boolean)).size
  const crs = new Set(linhasRecorte.filter((l) => (l.total ?? 0) > 0).map((l) => l.cr).filter(Boolean)).size
  const tipoSelecionado = tipoAtivo ? totais.find((t) => t.key === tipoAtivo) : null

  const evolucao = useMemo(() => {
    const mapa = new Map<string, { mes: string } & Partial<Record<ChaveOcorrencia, number>>>()
    for (const linha of linhasRecorte) {
      const ponto = mapa.get(linha.mes) ?? { mes: linha.mes }
      for (const tipo of TYPES_OCORRENCIA) {
        if (!tipoAtivo || tipoAtivo === tipo.key) ponto[tipo.key] = (ponto[tipo.key] ?? 0) + (Number(linha[tipo.key]) || 0)
      }
      mapa.set(linha.mes, ponto)
    }
    return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes)).map((p) => ({ ...p, mesLabel: fmtMes(p.mes) }))
  }, [linhasRecorte, tipoAtivo])
  const rankingCr = useMemo(() => {
    const mapa = new Map<string, { nome: string; valor: number }>()
    for (const linha of linhasRecorte) {
      const chave = linha.cr ?? "Sem CR"
      const item = mapa.get(chave) ?? { nome: linha.cr ? `${linha.cr} · ${nomeCr(linha.cr, linha.crNome)}` : "Sem CR", valor: 0 }
      item.valor += tipoAtivo ? Number(linha[tipoAtivo]) || 0 : Number(linha.total) || 0
      mapa.set(chave, item)
    }
    return [...mapa.values()].filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"))
  }, [linhasRecorte, tipoAtivo])
  const rankingFuncao = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const linha of linhasRecorte) {
      const funcao = linha.funcao ?? "Não informado"
      mapa.set(funcao, (mapa.get(funcao) ?? 0) + (tipoAtivo ? Number(linha[tipoAtivo]) || 0 : Number(linha.total) || 0))
    }
    return [...mapa].map(([rotulo, valor]) => ({ rotulo, valor })).filter((x) => x.valor > 0)
      .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR")).slice(0, 8)
  }, [linhasRecorte, tipoAtivo])
  const filtrosAtivos = Object.values(recorte).filter(Boolean).length
  const mesMaisRecente = opcoes.mes[0]
  const mesParcial = !!mesMaisRecente && mesMaisRecente === new Date().toISOString().slice(0, 7) && (!recorte.mes || recorte.mes === mesMaisRecente)

  function sincronizarUrl(novoRecorte: Recorte, tipo: string) {
    if (typeof window === "undefined") return
    window.history.replaceState(window.history.state, "", linkConformidade(window.location.pathname, { ...novoRecorte, tipo }))
  }
  function mudar(campo: keyof Recorte, valor: string) {
    const novoRecorte = { ...recorte, [campo]: valor }
    setRecorte(novoRecorte)
    sincronizarUrl(novoRecorte, tipoAtivo ?? "")
  }
  function selecionarTipo(tipo: ChaveOcorrencia | null) {
    setTipoAtivo(tipo)
    sincronizarUrl(recorte, tipo ?? "")
  }
  function limparFiltros() {
    const vazio: Recorte = { mes: "", cr: "", gerente: "", funcao: "", regional: "", supervisor: "" }
    setRecorte(vazio)
    sincronizarUrl(vazio, tipoAtivo ?? "")
  }

  return <div className="space-y-5 min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button type="button" aria-expanded={filtrosAbertos} onClick={() => setFiltrosAbertos((v) => !v)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-navy/15 bg-white px-3 text-sm font-medium text-navy transition hover:border-teal/50 hover:bg-teal-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
          <Filter className="h-4 w-4" />Filtros{filtrosAtivos > 0 && <span className="rounded-full bg-teal px-1.5 text-xs leading-5 text-white">{filtrosAtivos}</span>}<ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${filtrosAbertos ? "rotate-180" : ""}`} />
        </button>
        {filtrosAtivos > 0 && <button type="button" onClick={limparFiltros} className="rounded-md px-2 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">Limpar filtros</button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {tipoSelecionado && <button type="button" onClick={() => selecionarTipo(null)} className="rounded-md px-2 py-2 text-sm text-teal hover:bg-teal-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">Exibir todas as ocorrências</button>}
        <Link href={linkConformidade("/dashboards/conformidade-legal/detalhamento", filtrosAtuais)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-3 text-sm font-medium text-white transition hover:bg-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2">
          Ver detalhamento <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>

    {filtrosAbertos && <section aria-label="Filtros do painel" className="grid grid-cols-1 gap-3 rounded-2xl border border-navy/10 bg-white/80 p-4 shadow-card sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Filtro label="Mês" value={recorte.mes} options={opcoes.mes.map((v) => [v, fmtMes(v)])} onChange={(v) => mudar("mes", v)} />
      <Filtro label="CR" value={recorte.cr} options={opcoes.cr.map((v) => [v, `${v} · ${nomeCr(v, dados.linhas.find((l) => l.cr === v)?.crNome ?? null)}`])} onChange={(v) => mudar("cr", v)} />
      <Filtro label="Regional" value={recorte.regional} options={opcoes.regional.map((v) => [v, nome(v)])} onChange={(v) => mudar("regional", v)} />
      <Filtro label="Gerente" value={recorte.gerente} options={opcoes.gerente.map((v) => [v, nome(v)])} onChange={(v) => mudar("gerente", v)} />
      <Filtro label="Supervisor" value={recorte.supervisor} options={opcoes.supervisor.map((v) => [v, nome(v)])} onChange={(v) => mudar("supervisor", v)} />
      <Filtro label="Função" value={recorte.funcao} options={opcoes.funcao.map((v) => [v, nome(v)])} onChange={(v) => mudar("funcao", v)} />
      <div className="flex items-end justify-end xl:col-span-6"><button type="button" onClick={() => setFiltrosAbertos(false)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-destructive/25 px-3 text-sm font-medium text-destructive transition hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"><X className="h-4 w-4" />Fechar filtros</button></div>
    </section>}

    <section aria-label="Resumo do recorte" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Resumo titulo="Ocorrências" valor={fmtNumero.format(totalOcorrencias)} detalhe="no recorte atual" icone={<ClipboardList className="h-4 w-4" />} />
      <Resumo titulo="Pessoas com ocorrência" valor={fmtNumero.format(pessoas)} detalhe="pessoas distintas" icone={<Users className="h-4 w-4" />} />
      <Resumo titulo="CRs com ocorrência" valor={fmtNumero.format(crs)} detalhe="CRs" icone={<Building2 className="h-4 w-4" />} />
    </section>
    {!linhasRecorte.length && <p role="status" className="rounded-xl border border-navy/10 bg-white/70 px-4 py-3 text-sm text-muted-foreground">{dados.linhas.length ? "Nenhum registro corresponde aos filtros selecionados." : "Não há registros de conformidade disponíveis neste escopo."}</p>}

    <section aria-label="Ocorrências por categoria" className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      {totais.map((tipo) => {
        const participacao = totalOcorrencias ? fmtPercentual.format((tipo.valor / totalOcorrencias) * 100) : "0"
        const ativo = tipoAtivo === tipo.key
        return <button key={tipo.key} type="button" aria-pressed={ativo} onClick={() => selecionarTipo(ativo ? null : tipo.key)} className={`group min-h-[188px] min-w-0 rounded-3xl border p-4 text-left transition-colors sm:p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${ativo ? "border-teal bg-teal-tint" : "glass hover:border-teal/40"}`}>
          <span className="mb-3 block h-1 w-9 rounded-full" style={{ backgroundColor: tipo.cor }} />
          <span className="block min-h-10 text-sm font-medium leading-5 text-muted-foreground">{tipo.label}</span>
          <span className="mt-3 block text-3xl font-semibold tabular-nums tracking-tight text-navy">{fmtNumero.format(tipo.valor)}</span>
          <span className="mt-2 block text-xs tabular-nums text-muted-foreground">{participacao}% do total</span>
        </button>
      })}
    </section>

    <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <section className="glass min-w-0 rounded-3xl p-4 sm:p-5 md:col-span-2 xl:col-span-1">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-base font-semibold text-navy">Evolução mensal</h2><p className="mt-1 text-xs text-muted-foreground">{tipoSelecionado ? tipoSelecionado.label : "Todas as categorias"}</p></div>{mesParcial && <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">Mês atual em andamento</span>}</div>
        <div className="mt-4 h-64 min-w-0 overflow-hidden">
          {evolucao.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={evolucao} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.mes ? fmtMes(payload[0].payload.mes) : ""} formatter={(v, k, item) => [fmtNumero.format(Number(v) || 0), TYPES_OCORRENCIA.find((t) => t.key === item.dataKey)?.label ?? String(k)]} />
            {TYPES_OCORRENCIA.filter((t) => !tipoAtivo || t.key === tipoAtivo).map((t) => { const i = TYPES_OCORRENCIA.indexOf(t); return <Area key={t.key} isAnimationActive={false} type="monotone" dataKey={t.key} name={t.label} stackId={tipoAtivo ? undefined : "a"} stroke={CORES[i % CORES.length]} fill={CORES[i % CORES.length]} fillOpacity={tipoAtivo ? 0.14 : 0.08} strokeWidth={2} /> })}
          </AreaChart></ResponsiveContainer> : <Vazio>Sem ocorrências no recorte selecionado.</Vazio>}
        </div>
      </section>

      <section className="glass min-w-0 rounded-3xl p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2"><div><h2 className="text-base font-semibold text-navy">CRs com mais ocorrências</h2><p className="mt-1 text-xs text-muted-foreground">{tipoSelecionado?.label ?? "Todas as categorias"}</p></div><span className="shrink-0 text-xs text-muted-foreground">{rankingCr.length} CRs</span></div>
        <div className="mt-4 h-64 space-y-3 overflow-y-auto pr-1" tabIndex={0} aria-label="Ranking completo de CRs">
          {rankingCr.length ? rankingCr.map((item, i) => <div key={item.nome} className="grid grid-cols-[1.35rem_minmax(0,1fr)_2.5rem] items-center gap-2"><span className="text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span><div className="min-w-0"><div className="mb-1 truncate text-xs font-medium text-navy" title={item.nome}>{item.nome}</div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="visual-glow-bar h-full rounded-full bg-teal" style={{ width: `${Math.max(2, (item.valor / rankingCr[0].valor) * 100)}%` }} /></div></div><span className="text-right text-xs font-semibold tabular-nums text-navy">{fmtNumero.format(item.valor)}</span></div>) : <Vazio>Sem CRs com ocorrência neste recorte.</Vazio>}
        </div>
      </section>
    <section className="glass min-w-0 rounded-3xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2"><div><h2 className="text-base font-semibold text-navy">Funções</h2><p className="mt-1 text-xs text-muted-foreground">Mais ocorrências no recorte</p></div><span className="text-xs text-muted-foreground">{rankingFuncao.length} de {new Set(linhasRecorte.map((l) => l.funcao)).size}</span></div>
      <div className="mt-4 h-64 space-y-3 overflow-y-auto pr-1" tabIndex={0} aria-label="Funções com mais ocorrências">{rankingFuncao.length ? rankingFuncao.map((item, indice) => <div key={item.rotulo} className="grid grid-cols-[1.25rem_minmax(0,1fr)_3.5rem] items-center gap-2"><span className="text-right text-xs tabular-nums text-muted-foreground">{indice + 1}</span><div className="min-w-0"><span className="block truncate text-xs font-medium text-navy" title={nome(item.rotulo)}>{nome(item.rotulo)}</span><span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted"><span className="block visual-glow-bar h-full rounded-full bg-teal/75" style={{ width: `${Math.max(2, item.valor / (rankingFuncao[0]?.valor || 1) * 100)}%` }} /></span></div><span className="text-right text-xs font-semibold tabular-nums text-navy">{fmtNumero.format(item.valor)}</span></div>) : <Vazio>Sem funções com ocorrência.</Vazio>}</div>
    </section>
    </div>
  </div>
}

function unicos(valores: (string | null)[]) { return [...new Set(valores.filter((v): v is string => !!v && !!v.trim()))] }

function Filtro({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return <label className="block min-w-0 text-xs font-medium text-navy">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-navy/15 bg-white px-3 text-sm font-normal text-navy focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"><option value="">Todos</option>{options.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}</select></label>
}

function Resumo({ titulo, valor, detalhe, icone }: { titulo: string; valor: string; detalhe: string; icone: React.ReactNode }) {
  return <article className="glass flex min-h-28 min-w-0 items-center gap-4 rounded-3xl px-5 py-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal">{icone}</span><div className="min-w-0"><p className="truncate text-xs font-medium text-muted-foreground">{titulo}</p><div className="flex flex-wrap items-baseline gap-x-2"><strong className="text-2xl font-semibold tabular-nums tracking-tight text-navy">{valor}</strong><span className="text-[11px] text-muted-foreground">{detalhe}</span></div></div></article>
}

function Vazio({ children }: { children: React.ReactNode }) { return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p> }



