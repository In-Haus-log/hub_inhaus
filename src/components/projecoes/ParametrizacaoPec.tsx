"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Plus, Power } from "lucide-react"
import { valorLinha, type Item, type Natureza } from "@/lib/flash/calculos"
import { ABAS, abaDoItem, numeroEntrada, numeroTexto, tipoDaAba, unidadeDoItem, valorUnitarioTexto, type Aba } from "@/lib/projecoes/abas"
import { cn } from "@/lib/utils"

const campo = "h-10 w-full rounded-xl border border-navy/15 bg-white px-3 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
const botao = "rounded-xl border border-navy/15 px-4 py-2 text-sm text-navy disabled:opacity-50"
type Form = { descricao: string; natureza: Natureza; crCod: string; area: string; turno: string; unidade: string; remuneracao: "FIXO" | "VARIAVEL"; valor: string; qtd: string }
export function AbasPec({ aba, onChange, itens, disabled = false }: { aba: Aba; onChange: (a: Aba) => void; itens: Item[]; disabled?: boolean }) {
  return <div role="tablist" aria-label="Composição do contrato" className="mb-5 flex overflow-x-auto border-b border-navy/15">
    {ABAS.map((a, i) => <button key={a} type="button" role="tab" aria-selected={aba === a} tabIndex={aba === a ? 0 : -1} disabled={disabled}
      onKeyDown={e => { if (disabled) return; const next = e.key === "ArrowRight" ? (i + 1) % 4 : e.key === "ArrowLeft" ? (i + 3) % 4 : e.key === "Home" ? 0 : e.key === "End" ? 3 : -1; if (next >= 0) { e.preventDefault(); onChange(ABAS[next]); (e.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus() } }}
      onClick={() => onChange(a)} className={cn("shrink-0 rounded-t-xl border-b-2 px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal", aba === a ? "border-teal bg-teal-tint text-teal" : "border-transparent text-muted-foreground hover:bg-navy-mist hover:text-navy")}>
      {a}<span className="ml-2 text-xs tabular-nums">{itens.filter(i => i.ativo && abaDoItem(i) === a).length}</span>
    </button>)}
  </div>
}

export function ParametrizacaoPec({ pecCod, crPadrao, itens, crs, podeEditar = true, onBusy, onDirty }: { pecCod: string; crPadrao: string; itens: Item[]; crs: { cr: string; nome: string }[]; podeEditar?: boolean; onBusy?: (b: boolean) => void; onDirty?: (b: boolean) => void }) {
  const router = useRouter()
  const id = useId()
  const [lista, setLista] = useState(itens)
  const [aba, setAba] = useState<Aba>("Pessoas")
  const [editando, setEditando] = useState<number | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState("")
  const [aviso, setAviso] = useState("")
  const descricaoRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setLista(itens) }, [itens])
  const base = `/api/flash/pecs/${encodeURIComponent(pecCod)}/itens`
  function mudarBusy(b: boolean) { setBusy(b); onBusy?.(b) }
  function cancelar() { setForm(null); setEditando(null); setErro(""); onDirty?.(false) }
  function trocar(a: Aba) { if (form && !window.confirm("Descartar o item ainda não salvo?")) return; cancelar(); setAba(a) }
  function novo() {
    setEditando(null); setErro(""); setAviso(""); onDirty?.(true)
    setForm({ descricao: "", natureza: "RECEITA", crCod: crPadrao, area: "", turno: "", unidade: aba === "Pessoas" ? "Pessoas" : aba === "Hora Extra" ? "Horas" : "Unidades", remuneracao: aba === "Pessoas" ? "FIXO" : "VARIAVEL", valor: "", qtd: "" })
  }
  function editar(i: Item) {
    if (form && !window.confirm("Descartar o item ainda não salvo?")) return
    setEditando(i.id); setErro(""); setAviso(""); onDirty?.(true)
    setForm({ descricao: i.descricao, natureza: i.natureza, crCod: i.crCod, area: [i.agrupador, i.parametros?.turno].filter(Boolean).join(" / "), turno: "", unidade: unidadeDoItem(i), remuneracao: i.parametros?.remuneracao ?? (i.tipo === "FIXO" || i.tipo === "PESSOAS" ? "FIXO" : "VARIAVEL"), valor: numeroTexto(i.valorUnitario), qtd: numeroTexto(i.qtdPadrao) })
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); if (!form || busy) return
    if (!crs.some(c => c.cr === form.crCod)) { setErro("Selecione um CR disponível para este PEC."); return }
    const adicionarOutro = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("data-next") === "true"
    if (!form.area.trim()) { setErro("Informe Área / Turno."); return }
    const valorUnitario = numeroEntrada(form.valor), qtdPadrao = aba === "Hora Extra" && form.unidade === "Verba" ? 1 : numeroEntrada(form.qtd)
    if (!Number.isFinite(valorUnitario) || !Number.isFinite(qtdPadrao)) { setErro("Preencha o valor e a quantidade com números válidos, sem separador de milhar."); return }
    if (form.unidade === "Pessoas" && !Number.isInteger(qtdPadrao)) { setErro("A quantidade de pessoas deve ser inteira."); return }
    mudarBusy(true); setErro("")
    try {
      const r = await fetch(`${editando ? `${base}/${editando}` : base}?regional=lucas`, { method: editando ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ descricao: form.descricao, natureza: aba === "Glosas" ? "RECEITA" : form.natureza, tipo: tipoDaAba(aba, form.unidade), crCod: form.crCod, agrupador: form.area.trim(), valorUnitario, qtdPadrao, ordem: lista.find(i => i.id === editando)?.ordem ?? lista.length, parametros: { aba, unidadeMedida: form.unidade, remuneracao: form.remuneracao, turno: null } }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Não foi possível salvar o item.")
      setLista(l => editando ? l.map(i => i.id === editando ? d : i) : [...l, d]); cancelar(); if (adicionarOutro) { setForm({ ...form, descricao: "", valor: "", qtd: form.unidade === "Verba" ? "1" : "" }); onDirty?.(true); requestAnimationFrame(() => descricaoRef.current?.focus()) } setAviso("Item salvo."); router.refresh()
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar.") } finally { mudarBusy(false) }
  }
  async function ativar(i: Item) {
    if (busy || !window.confirm(`${i.ativo ? "Desativar" : "Reativar"} ${i.descricao}?`)) return
    mudarBusy(true); setErro("")
    try { const r = await fetch(`${base}/${i.id}?regional=lucas`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: !i.ativo }) }); if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Falha ao atualizar item.") } setLista(l => l.map(a => a.id === i.id ? { ...a, ativo: !a.ativo } : a)); router.refresh() }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha ao atualizar.") } finally { mudarBusy(false) }
  }
  const visiveis = lista.filter(i => abaDoItem(i) === aba && i.ativo)
  function input(key: keyof Form, label: string, numeric = false) {
    return <label className="block text-xs font-medium text-navy" htmlFor={`${id}-${key}`}>{label}<input id={`${id}-${key}`} className={`${campo} mt-1.5`} value={form?.[key] ?? ""} inputMode={numeric ? "decimal" : undefined} maxLength={numeric ? 24 : key === "descricao" ? 120 : 60} ref={key === "descricao" ? descricaoRef : undefined} autoFocus={key === "descricao"} required={key === "descricao" || key === "area" || numeric} onChange={e => setForm(f => f && ({ ...f, [key]: e.target.value }))} /></label>
  }
  return <div>
    <AbasPec aba={aba} onChange={trocar} itens={lista} disabled={busy} />
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-display text-base font-semibold text-navy">{aba === "Pessoas" ? "Funções e postos" : aba === "Hora Extra" ? "Horas por área e turno" : aba === "Variáveis" ? "Serviços e adicionais" : "Descontos do contrato"}</h3><div className="flex items-center gap-4">{podeEditar && <button type="button" disabled={busy || !!form} onClick={novo} className="flex items-center gap-2 rounded-xl bg-inhaus-grad px-4 py-2 text-sm text-white shadow-glow disabled:opacity-50"><Plus className="h-4 w-4" />Adicionar item</button>}</div></div>
    {erro && <p role="alert" className="mb-4 text-sm text-red-700">{erro}</p>}<p role="status" className="text-sm text-teal">{aviso}</p>
    {form && <form onSubmit={salvar} className="mb-5 space-y-4 rounded-2xl border border-navy/10 bg-navy-mist/40 p-4"><fieldset disabled={busy} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2">{input("descricao", aba === "Pessoas" ? "Função / posto" : aba === "Glosas" ? "Motivo da glosa" : "Descrição")}</div>
      <label className="text-xs font-medium text-navy">CR *<input className={`${campo} mt-1.5`} required pattern="[A-Za-z0-9]{5}" maxLength={5} list={`${id}-crs`} value={form.crCod} onChange={e => setForm({ ...form, crCod: e.target.value.toUpperCase() })} /><datalist id={`${id}-crs`}>{crs.filter(c => c.cr.startsWith(form.crCod)).slice(0, 50).map(c => <option key={c.cr} value={c.cr}>{c.nome}</option>)}</datalist><span className="mt-1 block truncate text-xs font-normal text-muted-foreground" title={crs.find(c => c.cr === form.crCod)?.nome}>{crs.find(c => c.cr === form.crCod)?.nome}</span></label>
      {input("area", "Área / Turno *")}
      <label className="text-xs font-medium text-navy">{aba === "Hora Extra" ? "Forma de lançamento" : "Unidade de medida"}<select className={`${campo} mt-1.5`} value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value, qtd: e.target.value === "Verba" ? "1" : "" })}>{(aba === "Pessoas" ? ["Pessoas", "Dias", "Postos"] : aba === "Hora Extra" ? ["Horas", "Verba"] : aba === "Glosas" ? ["Horas", "Dias", "Ocorrências", "Verba", "Unidades"] : ["Peças", "Unidades", "Viagens", "Dias", "Horas", "Verba"]).map(u => <option key={u} value={u}>{aba === "Hora Extra" ? u === "Horas" ? "Por horas" : "Valor consolidado" : u}</option>)}{!["Pessoas", "Dias", "Postos", "Horas", "Verba", "Ocorrências", "Unidades", "Peças", "Viagens"].includes(form.unidade) && <option>{form.unidade}</option>}</select></label>
      {aba !== "Hora Extra" && <label className="text-xs font-medium text-navy">Fixo ou variável<select className={`${campo} mt-1.5`} value={form.remuneracao} onChange={e => setForm({ ...form, remuneracao: e.target.value as Form["remuneracao"] })}><option value="FIXO">Fixo</option><option value="VARIAVEL">Variável</option></select></label>}
      {input("valor", aba === "Hora Extra" ? form.unidade === "Horas" ? "Valor da hora (R$)" : "Valor consolidado (R$)" : "Valor unitário (R$)", true)}{!(aba === "Hora Extra" && form.unidade === "Verba") && input("qtd", aba === "Hora Extra" ? "Quantidade de horas" : `Quantidade padrão (${form.unidade.toLowerCase()})`, true)}
    </fieldset><div className="flex flex-wrap items-center justify-end gap-3"><span className="mr-auto text-sm text-navy">Total padrão: <strong>{Number.isFinite(numeroEntrada(form.valor)) && Number.isFinite(numeroEntrada(form.unidade === "Verba" && aba === "Hora Extra" ? "1" : form.qtd)) ? valorUnitarioTexto(valorLinha(tipoDaAba(aba, form.unidade), numeroEntrada(form.valor), aba === "Hora Extra" && form.unidade === "Verba" ? 1 : numeroEntrada(form.qtd))) : "—"}</strong></span><button type="button" disabled={busy} className={botao} onClick={cancelar}>Cancelar</button><button disabled={busy} className={botao}>{busy && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}Salvar item</button>{!editando && <button disabled={busy} data-next="true" className="rounded-xl bg-inhaus-grad px-4 py-2 text-sm text-white disabled:opacity-50">Salvar e adicionar outro</button>}</div></form>}
    <div className="overflow-x-auto rounded-2xl border border-navy/10"><table className="w-full min-w-[760px] text-sm"><caption className="sr-only">Itens de {aba.toLowerCase()} do contrato</caption><thead className="bg-navy-mist/70 text-xs text-muted-foreground"><tr>{[aba === "Pessoas" ? "Função / posto" : aba === "Glosas" ? "Motivo" : "Descrição", "CR", "Área / Turno", "Fixo / variável", "Unidade", "Valor unit.", "Qtd. padrão", "Total padrão", "Ações"].map(c => <th key={c} scope="col" className="whitespace-nowrap px-3 py-3 text-left font-medium">{c}</th>)}</tr></thead><tbody>{visiveis.map(i => <tr key={i.id} className={cn("border-t border-navy/5", !i.ativo && "opacity-60")}><td className="px-3 py-3 font-medium text-navy">{i.descricao}{!i.ativo && <span className="ml-2 text-xs">Inativo</span>}</td><td className="px-3 py-3">{i.crCod}</td><td className="px-3 py-3">{[i.agrupador, i.parametros?.turno].filter(Boolean).join(" / ") || "Pendente"}</td><td className="px-3 py-3">{i.parametros?.remuneracao === "VARIAVEL" || (!i.parametros && i.tipo !== "FIXO" && i.tipo !== "PESSOAS") ? "Variável" : "Fixo"}</td><td className="px-3 py-3">{unidadeDoItem(i)}</td><td className="px-3 py-3 text-right tabular-nums">{valorUnitarioTexto(i.valorUnitario)}</td><td className="px-3 py-3 text-right tabular-nums">{numeroTexto(i.qtdPadrao)}</td><td className="px-3 py-3 text-right tabular-nums">{valorUnitarioTexto(valorLinha(i.tipo, i.valorUnitario, i.qtdPadrao))}</td><td className="px-3 py-3">{podeEditar && <div className="flex gap-2"><button disabled={busy || !!form} aria-label={`Editar ${i.descricao}`} title="Editar" className="rounded-lg p-2 text-teal hover:bg-teal-tint disabled:opacity-50" onClick={() => editar(i)}><Pencil className="h-4 w-4" /></button><button disabled={busy || !!form} aria-label={`${i.ativo ? "Desativar" : "Reativar"} ${i.descricao}`} title={i.ativo ? "Desativar" : "Reativar"} className="rounded-lg p-2 text-muted-foreground hover:bg-navy-mist disabled:opacity-50" onClick={() => ativar(i)}><Power className="h-4 w-4" /></button></div>}</td></tr>)}</tbody></table>{!visiveis.length && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum item em {aba.toLowerCase()}.</p>}</div>
  </div>
}
