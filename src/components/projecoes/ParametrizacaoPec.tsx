"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Plus, Power, X } from "lucide-react"

import { moeda } from "@/components/flash/moeda"
import { Combobox } from "@/components/ui/Combobox"
import { TIPOS, TIPOS_POR_NATUREZA, valorLinha, type Item, type Natureza, type TipoItem } from "@/lib/flash/calculos"
import { formatarNumero } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Parametrização do PEC: itens de RECEITA e de CUSTO, cada um com o seu CR.
 * Cadastro em sequência pelo teclado: Enter no formulário salva e devolve o foco à descrição.
 */

type Cr = { cr: string; nome: string }
type Form = { descricao: string; natureza: Natureza; tipo: TipoItem; valorUnitario: string; qtdPadrao: string; crCod: string; agrupador: string }

const ROTULO_QTD: Record<TipoItem, string> = {
  PESSOAS: "Pessoas", UNITARIO: "Quantidade", HORA_EXTRA: "Horas", DESCONTO: "Quantidade", FIXO: "Quantidade", TAXA: "Quantidade", VARIAVEL: "Quantidade",
}
const ROTULO_VALOR: Record<TipoItem, string> = {
  PESSOAS: "Valor por pessoa/mês", UNITARIO: "Valor unitário", HORA_EXTRA: "Valor da hora", DESCONTO: "Valor do desconto",
  FIXO: "Valor mensal", TAXA: "Valor da taxa", VARIAVEL: "Valor variável",
}
const NATUREZAS: { valor: Natureza; rotulo: string }[] = [
  { valor: "RECEITA", rotulo: "Receita" },
  { valor: "CUSTO", rotulo: "Custo" },
]

const num = (t: string) => Number(t.replace(/\./g, "").replace(",", "."))
const campo =
  "h-10 w-full rounded-xl border border-navy/15 bg-white px-3 text-sm text-navy outline-none transition focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/30"

export function ParametrizacaoPec({ pecCod, crPadrao, itens, crs }: { pecCod: string; crPadrao: string; itens: Item[]; crs: Cr[] }) {
  const router = useRouter()
  const vazio: Form = { descricao: "", natureza: "RECEITA", tipo: "PESSOAS", valorUnitario: "", qtdPadrao: "", crCod: crPadrao, agrupador: "" }
  const [form, setForm] = useState<Form>(vazio)
  const [editando, setEditando] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const descricaoRef = useRef<HTMLInputElement>(null)

  const opcoesCr = useMemo(() => crs.map((c) => ({ value: c.cr, label: `${c.cr} · ${c.nome}` })), [crs])
  const nomeCr = useMemo(() => new Map(crs.map((c) => [c.cr, c.nome])), [crs])
  const agrupadores = useMemo(() => [...new Set(itens.map((i) => i.agrupador).filter(Boolean))] as string[], [itens])
  const base = `/api/flash/pecs/${pecCod}/itens`

  function trocarNatureza(natureza: Natureza) {
    setForm((f) => ({ ...f, natureza, tipo: TIPOS_POR_NATUREZA[natureza].includes(f.tipo) ? f.tipo : TIPOS_POR_NATUREZA[natureza][0] }))
  }

  function editar(i: Item) {
    setEditando(i.id)
    setErro(null)
    setForm({
      descricao: i.descricao,
      natureza: i.natureza,
      tipo: i.tipo,
      valorUnitario: formatarNumero(i.valorUnitario, 2).replace(/\./g, ""),
      qtdPadrao: formatarNumero(i.qtdPadrao, Number.isInteger(i.qtdPadrao) ? 0 : 2).replace(/\./g, ""),
      crCod: i.crCod,
      agrupador: i.agrupador ?? "",
    })
    descricaoRef.current?.focus()
  }

  function cancelar() {
    setEditando(null)
    setForm(vazio)
    setErro(null)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    const ordemAtual = editando ? itens.find((i) => i.id === editando)?.ordem ?? 0 : itens.length
    setSalvando(true)
    const r = await fetch(editando ? `${base}/${editando}` : base, {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: form.descricao,
        natureza: form.natureza,
        tipo: form.tipo,
        valorUnitario: num(form.valorUnitario || "x"),
        qtdPadrao: form.tipo === "FIXO" && !form.qtdPadrao ? 1 : num(form.qtdPadrao || "0"),
        crCod: form.crCod,
        agrupador: form.agrupador || null,
        ordem: ordemAtual,
      }),
    })
    setSalvando(false)
    if (!r.ok) return setErro((await r.json()).error ?? "Falha ao salvar.")
    setEditando(null)
    setForm((f) => ({ ...vazio, natureza: f.natureza, tipo: f.tipo, crCod: f.crCod, agrupador: f.agrupador }))
    router.refresh()
    descricaoRef.current?.focus()
  }

  async function alternarAtivo(i: Item) {
    if (i.ativo && !confirm("O item sai das próximas semanas; semanas já enviadas não mudam. Desativar?")) return
    const r = await fetch(`${base}/${i.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !i.ativo }),
    })
    if (!r.ok) return setErro((await r.json()).error ?? "Falha ao atualizar.")
    router.refresh()
  }

  const secoes: { natureza: Natureza; titulo: string; vazioTxt: string }[] = [
    { natureza: "RECEITA", titulo: "Receitas", vazioTxt: "Nenhuma receita cadastrada. Comece pelas funções do contrato (tarifa × pessoas)." },
    { natureza: "CUSTO", titulo: "Custos", vazioTxt: "Nenhum custo cadastrado. Inclua hora extra, taxas e variáveis do contrato." },
  ]

  return (
    <div className="space-y-5">
      <form onSubmit={salvar} className="glass space-y-4 rounded-3xl p-5" aria-labelledby="titulo-form-item">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-form-item" className="font-display text-base font-semibold text-navy">
            {editando ? "Editar item" : "Novo item"}
          </h2>
          {editando && (
            <button type="button" onClick={cancelar} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
              <X className="h-4 w-4" aria-hidden /> Cancelar edição
            </button>
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">O que é</legend>
          <div role="radiogroup" className="inline-flex rounded-2xl border border-navy/10 bg-white/70 p-1">
            {NATUREZAS.map((n) => (
              <button
                key={n.valor}
                type="button"
                role="radio"
                aria-checked={form.natureza === n.valor}
                onClick={() => trocarNatureza(n.valor)}
                className={cn(
                  "rounded-xl px-4 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
                  form.natureza === n.valor ? "bg-inhaus-grad text-white shadow-glow" : "text-navy hover:bg-navy-mist",
                )}
              >
                {n.rotulo}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">Como é {form.natureza === "CUSTO" ? "lançado" : "cobrado"}</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {TIPOS_POR_NATUREZA[form.natureza].map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={form.tipo === t}
                onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
                  form.tipo === t ? "border-transparent bg-inhaus-grad text-white shadow-glow" : "border-navy/15 bg-white/70 text-navy hover:border-teal/40",
                )}
              >
                {TIPOS[t].rotulo}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 md:grid-cols-12">
          <label className="md:col-span-4">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Descrição</span>
            <input
              ref={descricaoRef}
              required
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder={form.natureza === "CUSTO" ? "Ex.: Hora extra 50% — separação" : form.tipo === "PESSOAS" ? "Ex.: Separador 1º turno" : "Ex.: Locação de caminhão"}
              className={campo}
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{ROTULO_VALOR[form.tipo]} (R$)</span>
            <input required inputMode="decimal" value={form.valorUnitario} onChange={(e) => setForm({ ...form, valorUnitario: e.target.value })} placeholder="0,00" className={cn(campo, "text-right tabular-nums")} />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{ROTULO_QTD[form.tipo]} padrão</span>
            <input inputMode="decimal" value={form.qtdPadrao} onChange={(e) => setForm({ ...form, qtdPadrao: e.target.value })} placeholder={form.tipo === "FIXO" ? "1" : "0"} className={cn(campo, "text-right tabular-nums")} />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Área (opcional)</span>
            <input list="agrupadores-pec" value={form.agrupador} onChange={(e) => setForm({ ...form, agrupador: e.target.value })} placeholder="Ex.: A220" className={campo} />
            <datalist id="agrupadores-pec">
              {agrupadores.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
          <div className="flex items-end md:col-span-2">
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-inhaus-grad px-4 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              {editando ? "Salvar" : "Adicionar"}
            </button>
          </div>
          <div className="md:col-span-6">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">CR do item</span>
            <Combobox
              value={form.crCod}
              onChange={(v) => setForm((f) => ({ ...f, crCod: v ?? f.crCod }))}
              options={opcoesCr}
              placeholder="Busque pelo código ou nome do CR"
              ariaLabel="CR do item"
            />
          </div>
        </div>
        {erro && (
          <p role="alert" className="text-sm text-red-700">
            {erro}
          </p>
        )}
      </form>

      {secoes.map((s) => {
        const lista = itens.filter((i) => i.natureza === s.natureza)
        return (
          <section key={s.natureza} aria-labelledby={`secao-${s.natureza}`} className="space-y-2">
            <h2 id={`secao-${s.natureza}`} className="font-display text-base font-semibold text-navy">
              {s.titulo} <span className="text-sm font-normal text-muted-foreground">({lista.filter((i) => i.ativo).length})</span>
            </h2>
            {lista.length === 0 ? (
              <p className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">{s.vazioTxt}</p>
            ) : (
              <div className="glass overflow-x-auto rounded-3xl">
                <table className="w-full text-sm">
                  <caption className="sr-only">Itens de {s.titulo.toLowerCase()} do PEC</caption>
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th scope="col" className="px-5 py-3 font-medium">Item</th>
                      <th scope="col" className="px-3 py-3 font-medium">Tipo</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Valor unit.</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Qtd. padrão</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Mês (padrão)</th>
                      <th scope="col" className="px-3 py-3 font-medium">CR</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((i) => (
                      <tr key={i.id} className={cn("border-t border-navy/5", !i.ativo && "opacity-50", editando === i.id && "bg-teal-tint/60")}>
                        <th scope="row" className="px-5 py-2.5 text-left font-normal text-navy">
                          {i.descricao}
                          {i.agrupador && <span className="ml-2 text-xs text-muted-foreground">{i.agrupador}</span>}
                          {!i.ativo && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}
                        </th>
                        <td className="px-3 py-2.5 text-muted-foreground">{TIPOS[i.tipo].rotulo}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatarNumero(i.valorUnitario, 2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatarNumero(i.qtdPadrao, Number.isInteger(i.qtdPadrao) ? 0 : 2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-navy">{moeda(valorLinha(i.tipo, i.valorUnitario, i.qtdPadrao), 2)}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground" title={nomeCr.get(i.crCod)}>
                          {i.crCod}
                          {nomeCr.get(i.crCod) ? ` · ${nomeCr.get(i.crCod)}` : ""}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-right">
                          <button type="button" onClick={() => editar(i)} aria-label={`Editar ${i.descricao}`} className="rounded-lg p-1.5 text-navy hover:bg-navy-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => alternarAtivo(i)}
                            aria-label={`${i.ativo ? "Desativar" : "Reativar"} ${i.descricao}`}
                            className={cn("rounded-lg p-1.5 hover:bg-navy-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal", i.ativo ? "text-red-700" : "text-teal")}
                          >
                            <Power className="h-4 w-4" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
