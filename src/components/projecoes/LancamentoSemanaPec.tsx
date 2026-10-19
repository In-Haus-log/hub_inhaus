"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { resumoSemana, valorLinha } from "@/lib/flash/calculos"
import type { SemanaCompleta } from "@/lib/flash/dados"
import type { Periodo } from "@/lib/flash/semanas"
import { abaDoItem, numeroEntrada, numeroTexto, unidadeDoItem, valorUnitarioTexto, type Aba } from "@/lib/projecoes/abas"
import { AbasPec } from "./ParametrizacaoPec"

export function LancamentoSemanaPec({ pecCod, periodo, onBusy, onDirty }: { pecCod: string; periodo: Periodo; onBusy: (b: boolean) => void; onDirty: (b: boolean) => void }) {
  const router = useRouter()
  const [dados, setDados] = useState<SemanaCompleta | null>(null)
  const [qtd, setQtd] = useState<Record<number, string>>({})
  const [comentario, setComentario] = useState("")
  const [aba, setAba] = useState<Aba>("Pessoas")
  const [erro, setErro] = useState("")
  const [aviso, setAviso] = useState("")
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const url = `/api/flash/pecs/${encodeURIComponent(pecCod)}/semanas/${periodo.mes}/${periodo.semana}?regional=lucas`
  useEffect(() => {
    const c = new AbortController(); setErro("")
    fetch(url, { signal: c.signal, cache: "no-store" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Falha ao abrir a semana."); return d as SemanaCompleta }).then(d => { setDados(d); setQtd(Object.fromEntries(d.linhas.map(l => [l.itemId, numeroTexto(l.quantidade)]))); setComentario(d.comentario ?? "") }).catch(e => { if (e.name !== "AbortError") setErro(e.message) })
    return () => c.abort()
  }, [url, retry])
  const linhas = dados?.linhas.map(l => ({ ...l, quantidade: numeroEntrada(qtd[l.itemId] ?? "") })) ?? []
  const itens = dados?.itens.filter(i => linhas.some(l => l.itemId === i.id)) ?? []
  const invalidos = new Set(linhas.filter(l => !Number.isFinite(l.quantidade) || l.quantidade < 0 || (itens.find(i => i.id === l.itemId)?.tipo === "PESSOAS" && !Number.isInteger(l.quantidade))).map(l => l.itemId))
  const travada = dados?.status === "ENVIADO"
  const resumo = dados && !invalidos.size ? resumoSemana(itens, linhas, dados.aliquota) : null
  async function salvar(enviar: boolean) {
    if (busy || travada || invalidos.size || !dados) return
    if (enviar && !window.confirm(`Lançar a semana ${periodo.semana}? Após o envio, as quantidades ficam bloqueadas.`)) return
    setBusy(true); onBusy(true); setErro(""); setAviso("")
    try {
      const r = await fetch(url, { method: enviar ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ linhas: linhas.map(({ itemId, quantidade }) => ({ itemId, quantidade })), comentario: comentario || null }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Não foi possível salvar a semana.")
      // Recarrega a foto oficial após o envio, sem criar apontamentos fictícios.
      const read = await fetch(url, { cache: "no-store" }); const atualizado = await read.json()
      if (!read.ok) { if (enviar) setDados({ ...dados, status: "ENVIADO" }); throw new Error("Semana salva. Feche e reabra para atualizar os totais.") }
      setDados(atualizado); setQtd(Object.fromEntries((atualizado as SemanaCompleta).linhas.map(l => [l.itemId, numeroTexto(l.quantidade)])))
      onDirty(false); setAviso(enviar ? "Semana lançada." : "Rascunho salvo."); router.refresh()
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar.") } finally { setBusy(false); onBusy(false) }
  }
  if (!dados) return <div className="py-10 text-center">{erro ? <><p role="alert">{erro}</p><button onClick={() => setRetry(t => t + 1)} className="mt-3 text-teal underline">Tentar novamente</button></> : <Loader2 aria-label="Carregando semana" className="mx-auto h-5 w-5 animate-spin text-teal" />}</div>
  return <div><AbasPec aba={aba} onChange={setAba} itens={itens} disabled={busy} />
    {travada && <p role="status" className="mb-4 rounded-xl bg-teal-tint p-3 text-sm text-teal">Semana lançada. Para alterar, solicite a reabertura ao financeiro.</p>}
    {erro && <p role="alert" className="mb-4 text-sm text-red-700">{erro}</p>}<p role="status" className="text-sm text-teal">{aviso}</p>
    <div className="overflow-x-auto rounded-2xl border border-navy/10"><table className="w-full min-w-[650px] text-sm"><caption className="sr-only">Lançamento de {aba.toLowerCase()} na semana {periodo.semana}</caption><thead className="bg-navy-mist/70 text-xs text-muted-foreground"><tr>{[aba === "Pessoas" ? "Função / posto" : aba === "Glosas" ? "Motivo" : "Descrição", "CR", "Área / turno", "Unidade", "Valor unit.", aba === "Hora Extra" ? "Horas / verba" : "Quantidade", "Total"].map(c => <th key={c} scope="col" className="px-3 py-3 text-left font-medium">{c}</th>)}</tr></thead><tbody>{itens.filter(i => abaDoItem(i) === aba).map(i => { const l = linhas.find(l => l.itemId === i.id)!; return <tr key={i.id} className="border-t border-navy/5"><th scope="row" className="px-3 py-3 text-left font-medium text-navy">{i.descricao}</th><td className="px-3 py-3">{i.crCod}</td><td className="px-3 py-3">{[i.agrupador, i.parametros?.turno].filter(Boolean).join(" / ") || "—"}</td><td className="px-3 py-3">{unidadeDoItem(i)}</td><td className="px-3 py-3 text-right tabular-nums">{valorUnitarioTexto(l.valorUnitario)}</td><td className="px-3 py-3"><input aria-label={`Quantidade de ${i.descricao}`} aria-invalid={invalidos.has(i.id)} disabled={travada || busy} inputMode="decimal" maxLength={24} className="h-10 w-28 rounded-xl border border-navy/15 bg-white px-3 text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 disabled:bg-navy-mist" value={qtd[i.id] ?? ""} onChange={e => { setQtd(q => ({ ...q, [i.id]: e.target.value })); onDirty(true); setAviso("") }} /></td><td className="px-3 py-3 text-right tabular-nums">{invalidos.has(i.id) ? "—" : valorUnitarioTexto(valorLinha(i.tipo, l.valorUnitario, l.quantidade))}</td></tr> })}</tbody></table>{!itens.some(i => abaDoItem(i) === aba) && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum item parametrizado em {aba.toLowerCase()}.</p>}</div>
    {invalidos.size > 0 && <p role="alert" className="mt-3 text-sm text-red-700">Revise as quantidades. Pessoas exige um número inteiro; os demais itens aceitam decimais.</p>}
    <label className="mt-5 block text-xs font-medium text-navy">Observações da semana<textarea disabled={travada || busy} maxLength={500} rows={2} className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40" value={comentario} onChange={e => { setComentario(e.target.value); onDirty(true) }} /></label>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-navy/10 pt-4"><div className="flex flex-wrap gap-6 text-sm"><span>Receita bruta <strong className="block tabular-nums text-navy">{resumo ? valorUnitarioTexto(resumo.bruta) : "—"}</strong></span><span>Custos <strong className="block tabular-nums text-navy">{resumo ? valorUnitarioTexto(resumo.custos) : "—"}</strong></span><span>ROL <strong className="block tabular-nums text-teal">{resumo ? valorUnitarioTexto(resumo.rol) : "—"}</strong></span></div>{!travada && <div className="flex flex-wrap gap-3"><button disabled={busy || invalidos.size > 0 || !linhas.length} className="rounded-xl border border-navy/15 px-4 py-2 text-sm disabled:opacity-50" onClick={() => salvar(false)}>Salvar rascunho</button><button disabled={busy || invalidos.size > 0 || !linhas.length} className="flex items-center gap-2 rounded-xl bg-inhaus-grad px-5 py-2 text-sm text-white shadow-glow disabled:opacity-50" onClick={() => salvar(true)}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Lançar Semana</button></div>}</div>
  </div>
}
