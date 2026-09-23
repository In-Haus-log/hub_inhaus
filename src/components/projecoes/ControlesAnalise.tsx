"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowUp, Filter, Plus, Save, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MultiCombobox } from "@/components/ui/MultiCombobox"
import { type ComboOption } from "@/components/ui/Combobox"
import { DIMENSOES, MAX_NIVEIS, rotuloDimensao, type DimensaoKey } from "@/lib/projecoes/dimensoes"
import {
  MEDIDAS,
  escreverEstado,
  rotuloMes,
  type EstadoAnalise,
  type Medida,
} from "@/lib/projecoes/parametros"
import { cn } from "@/lib/utils"

const CHAVE_PADRAO = "projecoes:padrao"
const DIMENSOES_FILTRO = DIMENSOES.filter((d) => d.key !== "subconta")

export function ControlesAnalise({ estado, meses }: { estado: EstadoAnalise; meses: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [filtrosAbertos, setFiltrosAbertos] = React.useState(false)
  const [opcoes, setOpcoes] = React.useState<Partial<Record<DimensaoKey, ComboOption[]>>>({})
  const [aviso, setAviso] = React.useState<string | null>(null)

  const ir = React.useCallback(
    (novo: EstadoAnalise) => router.push(`${pathname}?${escreverEstado(novo).toString()}`),
    [router, pathname],
  )

  // Sem nada na URL: aplica o padrão salvo neste navegador (se houver).
  React.useEffect(() => {
    if (window.location.search) return
    try {
      const salvo = window.localStorage.getItem(CHAVE_PADRAO)
      if (salvo) router.replace(`${pathname}?${salvo}`)
    } catch {
      /* armazenamento indisponível: segue com o padrão do sistema */
    }
  }, [router, pathname])

  // Carrega as opções dos filtros ao abrir o painel.
  React.useEffect(() => {
    if (!filtrosAbertos || !estado.periodo) return
    let vivo = true
    const base = escreverEstado(estado)
    Promise.all(
      DIMENSOES_FILTRO.map(async (d) => {
        const sp = new URLSearchParams(base)
        sp.set("dim", d.key)
        const r = await fetch(`/api/projecoes/opcoes?${sp.toString()}`, { cache: "no-store" })
        const dados = r.ok ? ((await r.json()) as { opcoes: ComboOption[] }) : { opcoes: [] }
        return [d.key, dados.opcoes] as const
      }),
    ).then((pares) => {
      if (vivo) setOpcoes(Object.fromEntries(pares))
    })
    return () => {
      vivo = false
    }
  }, [filtrosAbertos, estado])

  const disponiveis = DIMENSOES.filter((d) => !estado.niveis.includes(d.key))
  const qtdFiltros = Object.values(estado.filtros).reduce((n, v) => n + (v?.length ? 1 : 0), 0)
  const mesesAsc = [...meses].sort()

  function mover(i: number) {
    const niveis = [...estado.niveis]
    ;[niveis[i - 1], niveis[i]] = [niveis[i], niveis[i - 1]]
    ir({ ...estado, niveis })
  }

  function salvarPadrao() {
    try {
      window.localStorage.setItem(CHAVE_PADRAO, escreverEstado({ ...estado, periodo: null }).toString())
      setAviso("Padrão salvo neste navegador.")
    } catch {
      setAviso("Não foi possível salvar o padrão neste navegador.")
    }
  }

  return (
    <section className="glass reveal delay-1 space-y-4 rounded-3xl p-5" aria-label="Montagem da análise">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-navy">Linhas:</span>
        {estado.niveis.map((n, i) => (
          <span key={n} className="inline-flex items-center gap-1 rounded-full bg-teal-tint px-3 py-1 text-sm text-navy">
            {i > 0 && <span aria-hidden className="text-muted-foreground">›</span>}
            {rotuloDimensao(n)}
            {i > 0 && (
              <button
                type="button"
                onClick={() => mover(i)}
                className="rounded-full p-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
                aria-label={`Subir ${rotuloDimensao(n)} um nível`}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
            {estado.niveis.length > 1 && (
              <button
                type="button"
                onClick={() => ir({ ...estado, niveis: estado.niveis.filter((x) => x !== n) })}
                className="rounded-full p-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
                aria-label={`Remover ${rotuloDimensao(n)}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
        {estado.niveis.length < MAX_NIVEIS && disponiveis.length > 0 && (
          <label className="inline-flex items-center gap-1 text-sm text-teal">
            <Plus className="h-4 w-4" aria-hidden />
            <span className="sr-only">Adicionar nível</span>
            <select
              className="rounded-full border border-teal/30 bg-white px-2 py-1 text-sm text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
              value=""
              onChange={(e) => {
                const v = e.target.value as DimensaoKey
                if (v) ir({ ...estado, niveis: [...estado.niveis, v] })
              }}
            >
              <option value="">Adicionar nível…</option>
              {disponiveis.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div role="group" aria-label="Valor exibido" className="inline-flex rounded-full bg-navy-mist p-1">
          {MEDIDAS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={estado.medida === m.key}
              onClick={() => ir({ ...estado, medida: m.key as Medida })}
              className={cn(
                "rounded-full px-3 py-1 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal",
                estado.medida === m.key ? "bg-inhaus-grad text-white shadow-glow" : "text-navy hover:bg-white",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {estado.periodo && mesesAsc.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-navy">
            <label htmlFor="proj-de">De</label>
            <select
              id="proj-de"
              value={estado.periodo.de}
              onChange={(e) => ir({ ...estado, periodo: { de: e.target.value, ate: estado.periodo!.ate } })}
              className="rounded-lg border border-input bg-white px-2 py-1"
            >
              {mesesAsc.map((m) => (
                <option key={m} value={m}>
                  {rotuloMes(m)}
                </option>
              ))}
            </select>
            <label htmlFor="proj-ate">até</label>
            <select
              id="proj-ate"
              value={estado.periodo.ate}
              onChange={(e) => ir({ ...estado, periodo: { de: estado.periodo!.de, ate: e.target.value } })}
              className="rounded-lg border border-input bg-white px-2 py-1"
            >
              {mesesAsc.map((m) => (
                <option key={m} value={m}>
                  {rotuloMes(m)}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button type="button" variant="outline" size="sm" onClick={() => setFiltrosAbertos((v) => !v)} aria-expanded={filtrosAbertos}>
          <Filter className="mr-1.5 h-4 w-4" aria-hidden />
          Filtros{qtdFiltros > 0 ? ` (${qtdFiltros})` : ""}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={salvarPadrao}>
          <Save className="mr-1.5 h-4 w-4" aria-hidden />
          Salvar como meu padrão
        </Button>
        {aviso && (
          <span role="status" className="text-xs text-muted-foreground">
            {aviso}
          </span>
        )}
      </div>

      {filtrosAbertos && (
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {DIMENSOES_FILTRO.map((d) => (
            <div key={d.key}>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">{d.label}</span>
              <MultiCombobox
                values={estado.filtros[d.key] ?? []}
                options={opcoes[d.key] ?? []}
                placeholder="Todos"
                ariaLabel={`Filtrar por ${d.label}`}
                onChange={(valores) =>
                  ir({ ...estado, filtros: { ...estado.filtros, [d.key]: valores.length ? valores : undefined } })
                }
              />
            </div>
          ))}
          {qtdFiltros > 0 && (
            <div className="flex items-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => ir({ ...estado, filtros: {} })}>
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
