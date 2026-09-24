"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  formatarCelula,
  formatarMargem,
  resumo,
  tom,
  valorMedida,
  type No,
  type Par,
} from "@/lib/projecoes/calculos"
import { DIMENSOES_FINANCEIRAS, rotuloDimensao } from "@/lib/projecoes/dimensoes"
import { escreverEstado, rotuloMes, type EstadoAnalise } from "@/lib/projecoes/parametros"
import { cn } from "@/lib/utils"

export type AlvoDetalhe = { caminho: string[]; mes: string | null; titulo: string }

type Filhos = { status: "carregando" } | { status: "ok"; nos: No[] } | { status: "erro"; mensagem: string }

const COR_TOM = { bom: "text-emerald-700", ruim: "text-red-600", neutro: "" } as const

export function TabelaDinamica({
  estado,
  colunas,
  raiz,
  totais,
  onAbrirDetalhe,
}: {
  estado: EstadoAnalise
  colunas: string[]
  raiz: No[]
  totais: No
  onAbrirDetalhe: (alvo: AlvoDetalhe) => void
}) {
  const [abertos, setAbertos] = React.useState<Set<string>>(new Set())
  const [filhos, setFilhos] = React.useState<Record<string, Filhos>>({})
  const base = React.useMemo(() => escreverEstado(estado), [estado])
  const ultimoNivel = estado.niveis.length - 1

  const carregar = React.useCallback(
    async (caminho: string[]) => {
      const chave = JSON.stringify(caminho)
      setFilhos((f) => ({ ...f, [chave]: { status: "carregando" } }))
      const sp = new URLSearchParams(base)
      caminho.forEach((c) => sp.append("c", c))
      try {
        const r = await fetch(`/api/projecoes/nivel?${sp.toString()}`, { cache: "no-store" })
        const dados = await r.json()
        if (!r.ok) throw new Error(dados.error ?? "Falha ao carregar")
        setFilhos((f) => ({ ...f, [chave]: { status: "ok", nos: dados.nos as No[] } }))
      } catch (e) {
        setFilhos((f) => ({ ...f, [chave]: { status: "erro", mensagem: (e as Error).message } }))
      }
    },
    [base],
  )

  function alternar(caminho: string[]) {
    const chave = JSON.stringify(caminho)
    setAbertos((a) => {
      const novo = new Set(a)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
    if (!abertos.has(chave) && !filhos[chave]) void carregar(caminho)
  }

  function abrirPrimeiroNivel() {
    if (ultimoNivel < 1) return
    setAbertos(new Set(raiz.map((n) => JSON.stringify([n.chave]))))
    raiz.forEach((n) => {
      if (!filhos[JSON.stringify([n.chave])]) void carregar([n.chave])
    })
  }

  const celula = (par: Par | undefined, caminho: string[], mes: string | null, titulo: string) => {
    const v = valorMedida(estado.medida, par)
    if (v === null) return <td className="px-3 py-1.5" />
    return (
      <td className="px-1 py-0.5 text-right">
        <button
          type="button"
          onClick={() => onAbrirDetalhe({ caminho, mes, titulo })}
          className={cn(
            "w-full rounded-md px-2 py-1 text-right tabular-nums hover:bg-teal-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal",
            COR_TOM[tom(estado.medida, v)],
          )}
        >
          {formatarCelula(estado.medida, v)}
          <span className="sr-only">
            , ver lançamentos de {titulo}
            {mes ? ` em ${rotuloMes(mes)}` : " no período"}
          </span>
        </button>
      </td>
    )
  }

  const linhasResumo = (no: Pick<No, "meses" | "total">, recuo: number, prefixo: string) => {
    const itens: { rotulo: string; valor: (p: Par | undefined) => string; cor: (p: Par | undefined) => string }[] = [
      {
        rotulo: "ROL",
        valor: (p) => formatarCelula(estado.medida, resumo(p, estado.medida).rol),
        cor: (p) => COR_TOM[tom(estado.medida, resumo(p, estado.medida).rol)],
      },
      {
        rotulo: "MC (resultado)",
        valor: (p) => formatarCelula(estado.medida, resumo(p, estado.medida).mc),
        cor: (p) => COR_TOM[tom(estado.medida, resumo(p, estado.medida).mc)],
      },
      {
        rotulo: "% Margem",
        valor: (p) => (p ? formatarMargem(estado.medida, resumo(p, estado.medida).margem) : ""),
        cor: () => "",
      },
    ]
    return itens.map((it) => (
      <tr key={`${prefixo}-${it.rotulo}`} className="bg-navy-mist/60 text-xs">
        <th scope="row" className="sticky left-0 bg-navy-mist py-1 pr-3 text-left font-semibold text-navy" style={{ paddingLeft: recuo }}>
          {it.rotulo}
        </th>
        {colunas.map((m) => (
          <td key={m} className={cn("px-3 py-1 text-right tabular-nums", it.cor(no.meses[m]))}>
            {it.valor(no.meses[m])}
          </td>
        ))}
        <td className={cn("px-3 py-1 text-right font-semibold tabular-nums", it.cor(no.total))}>{it.valor(no.total)}</td>
      </tr>
    ))
  }

  const renderNo = (no: No, caminhoPai: string[], nivel: number): React.ReactNode => {
    const caminho = [...caminhoPai, no.chave]
    const chave = JSON.stringify(caminho)
    const aberto = abertos.has(chave)
    const podeAbrir = nivel < ultimoNivel
    const recuo = 12 + nivel * 20
    const rotulo = no.rotulo || "(sem valor)"
    const estadoFilhos = filhos[chave]
    const dimensao = estado.niveis[nivel]

    return (
      <React.Fragment key={chave}>
        <tr className="border-b border-border/60 hover:bg-teal-tint/40">
          <th scope="row" className="sticky left-0 bg-white py-1 pr-3 text-left font-normal text-navy" style={{ paddingLeft: recuo }}>
            <span className="flex items-center gap-1.5">
              {podeAbrir ? (
                <button
                  type="button"
                  onClick={() => alternar(caminho)}
                  aria-expanded={aberto}
                  aria-label={`${aberto ? "Recolher" : "Expandir"} ${rotulo}`}
                  className="rounded p-0.5 text-teal hover:bg-teal-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
                >
                  {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <span className="inline-block w-5" aria-hidden />
              )}
              <span className="whitespace-nowrap">{rotulo}</span>
            </span>
          </th>
          {colunas.map((m) => (
            <React.Fragment key={m}>{celula(no.meses[m], caminho, m, rotulo)}</React.Fragment>
          ))}
          {celula(no.total, caminho, null, rotulo)}
        </tr>
        {aberto && estadoFilhos?.status === "carregando" && (
          <tr>
            <td colSpan={colunas.length + 2} className="py-2 text-sm text-muted-foreground" style={{ paddingLeft: recuo + 24 }}>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
              Carregando…
            </td>
          </tr>
        )}
        {aberto && estadoFilhos?.status === "erro" && (
          <tr>
            <td colSpan={colunas.length + 2} role="alert" className="py-2 text-sm text-destructive" style={{ paddingLeft: recuo + 24 }}>
              {estadoFilhos.mensagem}
            </td>
          </tr>
        )}
        {aberto && estadoFilhos?.status === "ok" && (
          <>
            {estadoFilhos.nos.map((filho) => renderNo(filho, caminho, nivel + 1))}
            {!DIMENSOES_FINANCEIRAS.includes(dimensao) && linhasResumo(no, recuo + 24, chave)}
          </>
        )}
      </React.Fragment>
    )
  }

  return (
    <section className="glass reveal delay-2 rounded-3xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {estado.niveis.map(rotuloDimensao).join(" › ")} · clique num número para ver os lançamentos
        </p>
        <div className="flex gap-2">
          {ultimoNivel > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={abrirPrimeiroNivel}>
              Abrir 1º nível
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setAbertos(new Set())}>
            Recolher tudo
          </Button>
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-navy text-white">
            <tr>
              <th scope="col" className="sticky left-0 z-20 bg-navy px-3 py-2 text-left font-semibold">
                {rotuloDimensao(estado.niveis[0])}
              </th>
              {colunas.map((m) => (
                <th key={m} scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                  {rotuloMes(m)}
                </th>
              ))}
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                Total do período
              </th>
            </tr>
          </thead>
          <tbody>{raiz.map((no) => renderNo(no, [], 0))}</tbody>
          <tfoot className="border-t-2 border-navy">{linhasResumo(totais, 12, "total")}</tfoot>
        </table>
      </div>
    </section>
  )
}
