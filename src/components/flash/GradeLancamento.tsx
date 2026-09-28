"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, CloudOff, History, Loader2, Lock, Send } from "lucide-react"

import { moeda } from "@/components/flash/moeda"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TIPOS, alteracoes, receitaBruta, receitaLiquida, valorLinha, type Item } from "@/lib/flash/calculos"
import type { SemanaCompleta } from "@/lib/flash/dados"
import { formatarNumero } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Grade de lançamento semanal. SÓ a coluna "Esta semana" é editável.
 * Teclado: Enter desce, Shift+Enter sobe, Tab avança. Salvamento automático 800 ms após a
 * última digitação. Enviar mostra o resumo das alterações (de → para) antes de confirmar.
 */

const LIMITE_ABERTOS = 20

type Grupo = { chave: string; titulo: string; itens: Item[] }

function agrupar(itens: Item[]): Grupo[] {
  const grupos = new Map<string, Grupo>()
  for (const i of itens) {
    const chave = `${i.tipo}|${i.agrupador ?? ""}`
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave,
        titulo: [TIPOS[i.tipo].rotulo, i.agrupador].filter(Boolean).join(" · "),
        itens: [],
      })
    }
    grupos.get(chave)!.itens.push(i)
  }
  return [...grupos.values()]
}

const paraNumero = (txt: string) => {
  const n = Number(txt.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : NaN
}
const paraTexto = (n: number) => formatarNumero(n, Number.isInteger(n) ? 0 : 2).replace(/\./g, "")

export function GradeLancamento({ semana, url }: { semana: SemanaCompleta; url: string }) {
  const router = useRouter()
  const travada = semana.status === "ENVIADO"
  const itensDaSemana = useMemo(() => {
    const ids = new Set(semana.linhas.map((l) => l.itemId))
    return semana.itens.filter((i) => ids.has(i.id)).sort((a, b) => a.ordem - b.ordem || a.id - b.id)
  }, [semana])
  const grupos = useMemo(() => agrupar(itensDaSemana), [itensDaSemana])
  const ordemInputs = useMemo(() => grupos.flatMap((g) => g.itens.map((i) => i.id)), [grupos])

  const [qtd, setQtd] = useState(() => new Map(semana.linhas.map((l) => [l.itemId, paraTexto(l.quantidade)])))
  const [comentario, setComentario] = useState(semana.comentario ?? "")
  const [estado, setEstado] = useState<"salvo" | "salvando" | "erro">("salvo")
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const inputs = useRef(new Map<number, HTMLInputElement>())

  const valorUnit = useMemo(() => new Map(semana.linhas.map((l) => [l.itemId, l.valorUnitario])), [semana.linhas])
  const anterior = useMemo(
    () => (semana.anterior ? new Map(semana.anterior.map((l) => [l.itemId, l.quantidade])) : null),
    [semana.anterior],
  )

  const linhas = useMemo(
    () =>
      semana.linhas.map((l) => {
        const n = paraNumero(qtd.get(l.itemId) ?? "0")
        return { ...l, quantidade: Number.isNaN(n) ? 0 : n }
      }),
    [qtd, semana.linhas],
  )
  const invalidos = useMemo(() => {
    const s = new Set<number>()
    for (const i of itensDaSemana) {
      const n = paraNumero(qtd.get(i.id) ?? "")
      if (Number.isNaN(n) || n < 0 || (!TIPOS[i.tipo].decimais && !Number.isInteger(n))) s.add(i.id)
    }
    return s
  }, [qtd, itensDaSemana])

  const bruta = receitaBruta(semana.itens, linhas)
  const liquida = receitaLiquida(bruta, semana.aliquota)
  const mudancas = alteracoes(linhas, semana.anterior)
  const alterados = new Set(mudancas.map((m) => m.itemId))
  const nomeItem = new Map(semana.itens.map((i) => [i.id, i.descricao]))
  const corpo = () =>
    JSON.stringify({
      linhas: linhas.map(({ itemId, quantidade }) => ({ itemId, quantidade })),
      comentario: comentario || null,
    })

  // Foco inicial no 1º campo — só na montagem (o refresh após salvar não pode roubar o foco).
  useEffect(() => {
    if (!travada) {
      const primeiro = inputs.current.get(ordemInputs[0])
      primeiro?.focus()
      primeiro?.select()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Salvamento automático (debounce). Só salva o que mudou desde o último envio ao servidor
  // e nunca com campo inválido.
  const ultimoSalvo = useRef<string | null>(null)
  useEffect(() => {
    const atual = corpo()
    if (ultimoSalvo.current === null) ultimoSalvo.current = atual
    if (travada || invalidos.size > 0 || atual === ultimoSalvo.current) return
    setEstado("salvando")
    const t = setTimeout(async () => {
      try {
        const r = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: atual })
        if (r.ok) {
          ultimoSalvo.current = atual
          setEstado("salvo")
          setErro(null)
          router.refresh() // atualiza os indicadores do topo com o rascunho salvo
        } else {
          setEstado("erro")
          setErro((await r.json()).error ?? "Falha ao salvar.")
        }
      } catch {
        setEstado("erro")
        setErro("Sem conexão. Suas alterações serão salvas quando a conexão voltar.")
      }
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qtd, comentario])

  function mover(itemId: number, passo: number) {
    const i = ordemInputs.indexOf(itemId) + passo
    const alvo = inputs.current.get(ordemInputs[i])
    alvo?.focus()
    alvo?.select()
  }

  function repetirAnterior() {
    if (!anterior) return
    setQtd((q) => {
      const n = new Map(q)
      for (const [id, v] of anterior) if (n.has(id)) n.set(id, paraTexto(v))
      return n
    })
  }

  async function enviar() {
    setEnviando(true)
    setErro(null)
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo() })
    setEnviando(false)
    if (!r.ok) {
      setConfirmando(false)
      return setErro((await r.json()).error ?? "Falha ao enviar.")
    }
    setConfirmando(false)
    router.refresh()
  }

  if (itensDaSemana.length === 0) return null
  const muitosItens = itensDaSemana.length > LIMITE_ABERTOS

  return (
    <div className="space-y-4">
      {travada ? (
        <div className="flex items-center gap-3 rounded-2xl border border-teal/20 bg-teal-tint px-4 py-3 text-sm text-teal-deep">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Semana enviada{semana.enviadoPor ? ` por ${semana.enviadoPor}` : ""}
            {semana.enviadoEm
              ? ` em ${new Date(semana.enviadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
              : ""}
            . Para corrigir, peça ao financeiro para reabrir.
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Mude só o que mudou. <span className="text-navy">Enter</span> desce para a próxima linha.
          </p>
          {anterior && (
            <button
              type="button"
              onClick={repetirAnterior}
              className="inline-flex items-center gap-2 rounded-xl border border-navy/10 bg-white/70 px-3 py-1.5 text-sm font-medium text-navy transition hover:border-teal/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <History className="h-4 w-4 text-teal" aria-hidden /> Repetir semana anterior
            </button>
          )}
        </div>
      )}

      {grupos.map((g) => {
        const subtotal = g.itens.reduce(
          (s, i) => s + valorLinha(i.tipo, valorUnit.get(i.id) ?? 0, linhas.find((l) => l.itemId === i.id)?.quantidade ?? 0),
          0,
        )
        const temAlteracao = g.itens.some((i) => alterados.has(i.id) || invalidos.has(i.id))
        return (
          <details key={g.chave} open={!muitosItens || temAlteracao} className="glass group/grupo overflow-hidden rounded-3xl">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal">
              <span className="flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-teal transition group-open/grupo:rotate-180" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-navy">{g.titulo}</span>
                <span className="text-xs text-muted-foreground">({g.itens.length})</span>
              </span>
              <span className={cn("font-display text-sm font-semibold tabular-nums", subtotal < 0 ? "text-red-700" : "text-navy")}>
                {moeda(subtotal)}
              </span>
            </summary>
            <div className="overflow-x-auto border-t border-navy/5">
              <table className="w-full text-sm">
                <caption className="sr-only">Itens de {g.titulo}</caption>
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-2 font-medium">Item</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Valor unit.</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Sem. ant.</th>
                    <th scope="col" className="w-32 px-3 py-2 text-right font-medium text-navy">Esta semana</th>
                    <th scope="col" className="px-5 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {g.itens.map((i) => {
                    const q = linhas.find((l) => l.itemId === i.id)?.quantidade ?? 0
                    const vu = valorUnit.get(i.id) ?? 0
                    const mudou = alterados.has(i.id)
                    const invalido = invalidos.has(i.id)
                    const idErro = `erro-item-${i.id}`
                    return (
                      <tr key={i.id} className={cn("border-t border-navy/5", mudou && "bg-teal-tint/60")}>
                        <th scope="row" className="px-5 py-2 text-left font-normal text-navy">
                          <span className="inline-flex items-center gap-2">
                            {mudou && (
                              <span className="text-teal" aria-hidden>
                                ◆
                              </span>
                            )}
                            {i.descricao}
                            {mudou && <span className="sr-only">(alterado)</span>}
                          </span>
                        </th>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatarNumero(vu, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {anterior?.has(i.id) ? paraTexto(anterior.get(i.id)!) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <input
                            ref={(el) => {
                              if (el) inputs.current.set(i.id, el)
                              else inputs.current.delete(i.id)
                            }}
                            inputMode="decimal"
                            readOnly={travada}
                            value={qtd.get(i.id) ?? ""}
                            onChange={(e) => {
                              const v = e.target.value
                              setQtd((m) => new Map(m).set(i.id, v))
                            }}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                mover(i.id, e.shiftKey ? -1 : 1)
                              }
                            }}
                            aria-label={`${i.descricao} — quantidade desta semana`}
                            aria-invalid={invalido || undefined}
                            aria-describedby={invalido ? idErro : undefined}
                            className={cn(
                              "h-9 w-full rounded-lg border bg-white px-2.5 text-right font-medium tabular-nums text-navy outline-none transition focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/30",
                              invalido ? "border-red-400" : "border-navy/15",
                              travada && "border-transparent bg-transparent",
                            )}
                          />
                          {invalido && (
                            <span id={idErro} className="mt-1 block text-left text-xs text-red-700">
                              {TIPOS[i.tipo].decimais ? "Número ≥ 0" : "Número inteiro ≥ 0"}
                            </span>
                          )}
                        </td>
                        <td className={cn("px-5 py-2 text-right font-medium tabular-nums", i.tipo === "DESCONTO" ? "text-red-700" : "text-navy")}>
                          {moeda(valorLinha(i.tipo, vu, q), 2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )
      })}

      <div className="glass sticky bottom-4 z-10 flex flex-col gap-3 rounded-3xl p-4 shadow-soft lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-wrap items-baseline gap-x-6 gap-y-1">
          <p>
            <span className="text-xs text-muted-foreground">Receita bruta </span>
            <span className="font-display text-lg font-semibold tabular-nums text-navy">{moeda(bruta, 2)}</span>
          </p>
          <p>
            <span className="text-xs text-muted-foreground">Líquida </span>
            <span className="font-display text-lg font-semibold tabular-nums text-teal">{moeda(liquida, 2)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {mudancas.length === 0 ? "Sem alterações" : `${mudancas.length} ${mudancas.length === 1 ? "alteração" : "alterações"}`}
          </p>
          <p aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {!travada && estado === "salvando" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Salvando…
              </>
            )}
            {!travada && estado === "salvo" && (
              <>
                <Check className="h-3.5 w-3.5 text-teal" aria-hidden /> Rascunho salvo
              </>
            )}
            {estado === "erro" && (
              <span className="inline-flex items-center gap-1.5 text-red-700">
                <CloudOff className="h-3.5 w-3.5" aria-hidden /> Não salvo
              </span>
            )}
          </p>
        </div>
        {travada ? (
          semana.comentario && <p className="text-sm text-muted-foreground lg:max-w-xs">“{semana.comentario}”</p>
        ) : (
          <>
        <label className="sr-only" htmlFor="comentario-semana">
          Comentário da semana
        </label>
        <input
          id="comentario-semana"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Comentário (ex.: 2 vagas sem reposição)"
          maxLength={500}
          className="h-10 rounded-xl border border-navy/15 bg-white px-3 text-sm text-navy outline-none focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/30 lg:w-72"
        />
          </>
        )}
        {!travada && (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={invalidos.size > 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-inhaus-grad px-5 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden /> Enviar semana
          </button>
        )}
      </div>
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar a projeção da semana?</DialogTitle>
            <DialogDescription>
              Depois de enviada, a semana fica travada. Receita líquida projetada:{" "}
              <strong className="text-navy">{moeda(liquida, 2)}</strong>.
            </DialogDescription>
          </DialogHeader>
          {mudancas.length > 0 ? (
            <ul className="max-h-60 space-y-1 overflow-y-auto rounded-xl bg-navy-mist p-3 text-sm">
              {mudancas.map((m) => (
                <li key={m.itemId} className="flex justify-between gap-3">
                  <span className="text-navy">{nomeItem.get(m.itemId)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {paraTexto(m.de)} → <strong className="text-navy">{paraTexto(m.para)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {semana.anterior ? "Nenhuma alteração em relação à semana anterior." : "Primeira projeção deste PEC."}
            </p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="h-10 rounded-xl border border-navy/15 px-4 text-sm font-medium text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={enviando}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-inhaus-grad px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              Confirmar envio
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
