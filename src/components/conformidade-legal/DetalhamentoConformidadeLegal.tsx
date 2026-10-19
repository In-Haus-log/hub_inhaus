"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown, ChevronRight, Search, Plus, X, ChevronsUp } from "lucide-react"
import { filtrarConformidade, linkConformidade, type FiltrosConformidade } from "@/lib/conformidade-legal-filtros"
import { TYPES_OCORRENCIA, type DadosConformidadeLegal, type LinhaConformidadeLegal } from "@/lib/conformidade-legal-modelo"
import { tituloNome } from "@/lib/nomes"

type Dimensao = "regional" | "gerente" | "cr" | "supervisor" | "funcao" | "mes" | "pessoa"
const AGRUPAMENTOS: { valor: Dimensao; rotulo: string }[] = [
  { valor: "regional", rotulo: "Regional" }, { valor: "gerente", rotulo: "Gerente" },
  { valor: "cr", rotulo: "CR" }, { valor: "supervisor", rotulo: "Supervisor" },
  { valor: "funcao", rotulo: "Função" }, { valor: "mes", rotulo: "Mês" },
]
const fmtNumero = new Intl.NumberFormat("pt-BR")
const nome = (valor: string | null | undefined) => valor?.trim() ? tituloNome(valor) : "Não informado"
const fmtMes = (mes: string) => {
  const [ano, numero] = mes.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(ano, numero - 1, 1)))
}
const fmtCr = (linha: Pick<LinhaConformidadeLegal, "cr" | "crNome">) => linha.cr ? `${linha.cr} · ${nomeCr(linha.cr, linha.crNome)}` : linha.crNome || "Não informado"
function nomeCr(codigo: string, descricao: string | null) {
  const valor = descricao?.trim() ?? ""
  const semCodigo = valor.replace(new RegExp(`^${codigo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:[-–·:]\\s*)?`), "")
  return semCodigo || valor || "Não informado"
}

function valorDimensao(linha: LinhaConformidadeLegal, dimensao: Dimensao): string {
  if (dimensao === "cr") return fmtCr(linha)
  if (dimensao === "pessoa") return nome(linha.colaborador)
  const valor = linha[dimensao]
  return valor ?? "Não informado"
}

function ocorrencias(linhas: LinhaConformidadeLegal[], tipo: string) {
  if (tipo) return linhas.reduce((soma, linha) => soma + Math.max(0, Number(linha[tipo as (typeof TYPES_OCORRENCIA)[number]["key"]]) || 0), 0)
  return linhas.reduce((soma, linha) => soma + TYPES_OCORRENCIA.reduce((subtotal, categoria) => subtotal + Math.max(0, Number(linha[categoria.key]) || 0), 0), 0)
}

function pessoas(linhas: LinhaConformidadeLegal[]) {
  return new Set(linhas.flatMap((linha) => linha.pessoaId ? [linha.pessoaId] : [])).size
}

function correspondeBusca(linha: LinhaConformidadeLegal, busca: string) {
  if (!busca) return true
  return [linha.mes, linha.cr, linha.crNome, linha.regional, linha.gerente, linha.supervisor, linha.funcao, linha.colaborador,
    ...TYPES_OCORRENCIA.map((tipo) => String(linha[tipo.key] ?? "")), String(linha.total ?? "")]
    .some((valor) => String(valor ?? "").toLocaleLowerCase("pt-BR").includes(busca))
}

export function DetalhamentoConformidadeLegal({ dados, filtros }: { dados: DadosConformidadeLegal; filtros: FiltrosConformidade }) {
  const [sequencia, setSequencia] = useState<Dimensao[]>(["regional", "gerente", "cr"])
  const agrupamento = sequencia[0]!
  const [busca, setBusca] = useState("")
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set())
  useEffect(() => { setAbertos(new Set()) }, [dados, filtros])
  const linhas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR")
    return filtrarConformidade(dados.linhas, filtros).filter((linha) => correspondeBusca(linha, termo))
  }, [dados.linhas, filtros, busca])

  const grupos = useMemo(() => agrupar(linhas, agrupamento), [linhas, agrupamento])
  const dimensoes = [...sequencia, "pessoa"] as Dimensao[]
  const totalOcorrencias = ocorrencias(linhas, filtros.tipo)
  const totalPessoas = pessoas(linhas)
  const rotulosFiltros = [
    ["Mês", filtros.mes], ["CR", filtros.cr ? fmtCr(dados.linhas.find((linha) => linha.cr === filtros.cr) ?? { cr: filtros.cr, crNome: null }) : ""], ["Regional", filtros.regional], ["Gerente", filtros.gerente],
    ["Supervisor", filtros.supervisor], ["Função", filtros.funcao],
    ["Tipo", filtros.tipo ? TYPES_OCORRENCIA.find((item) => item.key === filtros.tipo)?.label ?? filtros.tipo : ""],
  ].filter((item): item is [string, string] => !!item[1])

  function alternar(chave: string) {
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  }

  function mudarSequencia(proxima: Dimensao[]) {
    setSequencia(proxima)
    setAbertos(new Set())
  }

  function renderGrupos(itens: { chave: string; valor: string; linhas: LinhaConformidadeLegal[] }[], indice: number, pai: string): React.ReactNode[] {
    const dimensao = dimensoes[indice]
    if (!dimensao) return []
    if (dimensao === "pessoa") {
      return itens.flatMap((grupo) => grupo.linhas.map((linha, i) => <tr key={`${grupo.chave}-${linha.mes}-${i}`} className="border-t border-navy/5 hover:bg-white/60">
        <td className="px-4 py-2.5 pl-12 text-navy"><span className="block whitespace-nowrap font-medium">{nome(linha.colaborador)} · {fmtMes(linha.mes)}</span><span className="block truncate text-xs text-muted-foreground" title={`${fmtCr(linha)} · ${nome(linha.funcao)}`}>{fmtCr(linha)} · {nome(linha.funcao)}</span></td>
        <td className="px-4 py-2.5 text-right tabular-nums text-navy">{fmtNumero.format(ocorrencias([linha], filtros.tipo))}</td>
        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{linha.pessoaId ? "1" : "—"}</td>
        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">1</td>
      </tr>))
    }
    return itens.flatMap((grupo) => {
      const chave = `${pai}/${grupo.chave}`
      const expandido = abertos.has(chave)
      const filhos = indice + 1 < dimensoes.length ? agrupar(grupo.linhas, dimensoes[indice + 1]!) : []
      const rotulo = dimensao === "mes" ? fmtMes(grupo.valor) : grupo.valor
      return [
        <tr key={chave} className="border-t border-navy/5 hover:bg-white/60">
          <th scope="row" className="px-3 py-2.5 text-left" style={{ paddingLeft: `${12 + indice * 20}px` }}>
            <button type="button" aria-expanded={expandido} aria-label={`${expandido ? "Recolher" : "Expandir"} ${rotulo}`} onClick={() => alternar(chave)} className="inline-flex max-w-full items-center gap-2 rounded px-1 py-0.5 text-left text-navy hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
              {expandido ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />}<span className="truncate font-medium">{rotulo}</span>
            </button>
          </th>
          <td className="px-4 py-2.5 text-right font-medium tabular-nums text-navy">{fmtNumero.format(ocorrencias(grupo.linhas, filtros.tipo))}</td>
          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmtNumero.format(pessoas(grupo.linhas))}</td>
          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmtNumero.format(grupo.linhas.length)}</td>
        </tr>,
        ...(expandido ? renderGrupos(filhos, indice + 1, chave) : []),
      ]
    })
  }

  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href={linkConformidade("/dashboards/conformidade-legal", filtros)} className="inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-navy transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Visão geral</Link>
      <label className="relative block w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input value={busca} onChange={(evento) => { setBusca(evento.target.value); setAbertos(new Set()) }} placeholder="Buscar nos resultados" aria-label="Buscar nos resultados" className="h-9 w-full rounded-lg border border-navy/15 bg-white pl-9 pr-3 text-sm text-navy placeholder:text-muted-foreground focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20" /></label>
    </div>

    <section aria-label="Filtros aplicados" className="flex flex-wrap items-center gap-2 rounded-xl border border-navy/10 bg-white/60 px-3 py-2.5">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recorte</span>
      {rotulosFiltros.length ? rotulosFiltros.map(([rotulo, valor]) => <span key={rotulo} className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-navy"><span className="text-muted-foreground">{rotulo}</span><strong className="truncate font-medium" title={valor}>{rotulo === "Mês" ? fmtMes(valor) : rotulo === "Tipo" || rotulo === "CR" ? valor : nome(valor)}</strong></span>) : <span className="text-xs text-muted-foreground">Todos os dados disponíveis</span>}
    </section>

    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex w-full flex-wrap items-end gap-2">
        {sequencia.map((dimensao, indice) => <div key={indice} className="flex min-w-0 flex-1 items-end gap-1 sm:flex-none">
          <label className="block min-w-0 flex-1 text-xs font-medium text-navy sm:w-44">Nível {indice + 1}<select aria-label={`Agrupamento do nível ${indice + 1}`} value={dimensao} onChange={(evento) => mudarSequencia(sequencia.map((item, posicao) => posicao === indice ? evento.target.value as Dimensao : item === evento.target.value ? dimensao : item))} className="mt-1.5 h-9 w-full rounded-lg border border-navy/15 bg-white px-2.5 text-sm font-normal text-navy focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20">{AGRUPAMENTOS.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}</select></label>
          {sequencia.length > 1 && <button type="button" aria-label={`Remover nível ${indice + 1}`} onClick={() => mudarSequencia(sequencia.filter((_, posicao) => posicao !== indice))} className="h-9 rounded-lg px-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"><X className="h-4 w-4" /></button>}
        </div>)}
        {sequencia.length < AGRUPAMENTOS.length && <button type="button" onClick={() => mudarSequencia([...sequencia, AGRUPAMENTOS.find((opcao) => !sequencia.includes(opcao.valor))!.valor])} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-navy/15 px-3 text-xs font-medium text-navy hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"><Plus className="h-4 w-4" />Adicionar nível</button>}
        <button type="button" disabled={!abertos.size} onClick={() => setAbertos(new Set())} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-navy hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"><ChevronsUp className="h-4 w-4" />Recolher tudo</button>
      </div>
      <p className="text-xs text-muted-foreground">{fmtNumero.format(linhas.length)} registros · {fmtNumero.format(totalPessoas)} pessoas · {fmtNumero.format(totalOcorrencias)} ocorrências</p>
    </div>

    <section className="glass min-w-0 overflow-hidden rounded-xl" aria-label="Detalhamento de conformidade legal">
      <div className="max-h-[68vh] overflow-auto"><table className="w-full min-w-[660px] border-collapse text-sm">
        <caption className="sr-only">Resultados agrupados por {AGRUPAMENTOS.find((opcao) => opcao.valor === agrupamento)?.rotulo}; expanda uma linha para ver o próximo nível.</caption>
        <thead className="sticky top-0 z-10 bg-muted text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><tr><th scope="col" className="px-4 py-3 text-left">{AGRUPAMENTOS.find((opcao) => opcao.valor === agrupamento)?.rotulo} / detalhamento</th><th scope="col" className="px-4 py-3 text-right">Ocorrências</th><th scope="col" className="px-4 py-3 text-right">Pessoas</th><th scope="col" className="px-4 py-3 text-right">Registros</th></tr></thead>
        <tbody>{grupos.length ? renderGrupos(grupos, 0, agrupamento) : <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">{dados.linhas.length ? "Nenhum registro corresponde aos filtros e à busca." : "Não há registros de conformidade disponíveis neste escopo."}</td></tr>}</tbody>
      </table></div>
    </section>
  </div>
}

function agrupar(linhas: LinhaConformidadeLegal[], dimensao: Dimensao) {
  const mapa = new Map<string, LinhaConformidadeLegal[]>()
  for (const linha of linhas) {
    const valor = dimensao === "cr" ? linha.cr ?? linha.crNome ?? "Não informado"
      : dimensao === "pessoa" ? linha.pessoaId ?? linha.colaborador ?? "Pessoa sem identificação"
      : linha[dimensao] ?? "Não informado"
    const chave = String(valor)
    const lista = mapa.get(chave) ?? []
    lista.push(linha)
    mapa.set(chave, lista)
  }
  return [...mapa].map(([chave, registros]) => ({ chave: encodeURIComponent(chave), valor: valorDimensao(registros[0]!, dimensao), linhas: registros }))
    .sort((a, b) => a.valor.localeCompare(b.valor, "pt-BR", { numeric: true }))
}


