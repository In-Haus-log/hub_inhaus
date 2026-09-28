"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Plus, Power, X } from "lucide-react"

import { moeda } from "@/components/flash/moeda"
import { Combobox } from "@/components/ui/Combobox"
import { TIPOS, type Item, type TipoItem } from "@/lib/flash/calculos"
import { formatarNumero } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Parametrização dos itens cobrados do PEC. Cadastro em sequência pelo teclado:
 * Enter no formulário salva e devolve o foco à descrição.
 */

type Conta = { conta: string; nome: string; grupo: string | null }
type Form = { descricao: string; tipo: TipoItem; valorUnitario: string; qtdPadrao: string; conta: string | null; agrupador: string }

const VAZIO: Form = { descricao: "", tipo: "PESSOAS", valorUnitario: "", qtdPadrao: "", conta: TIPOS.PESSOAS.contaSugerida, agrupador: "" }
const TIPOS_ORDEM: TipoItem[] = ["PESSOAS", "UNITARIO", "HORA_EXTRA", "DESCONTO", "FIXO"]
const ROTULO_QTD: Record<TipoItem, string> = {
  PESSOAS: "Pessoas",
  UNITARIO: "Quantidade",
  HORA_EXTRA: "Horas",
  DESCONTO: "Quantidade",
  FIXO: "Quantidade",
}
const ROTULO_VALOR: Record<TipoItem, string> = {
  PESSOAS: "Valor por pessoa/mês",
  UNITARIO: "Valor unitário",
  HORA_EXTRA: "Valor da hora",
  DESCONTO: "Valor do desconto",
  FIXO: "Valor mensal",
}

const num = (t: string) => Number(t.replace(/\./g, "").replace(",", "."))
const campo =
  "h-10 w-full rounded-xl border border-navy/15 bg-white px-3 text-sm text-navy outline-none transition focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/30"

export function Parametrizacao({ pecCod, itens, contas }: { pecCod: string; itens: Item[]; contas: Conta[] }) {
  const router = useRouter()
  const [form, setForm] = useState<Form>(VAZIO)
  const [editando, setEditando] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const descricaoRef = useRef<HTMLInputElement>(null)

  const opcoesConta = useMemo(() => contas.map((c) => ({ value: c.conta, label: `${c.conta} · ${c.nome}` })), [contas])
  const nomeConta = useMemo(() => new Map(contas.map((c) => [c.conta, c.nome])), [contas])
  const agrupadores = useMemo(() => [...new Set(itens.map((i) => i.agrupador).filter(Boolean))] as string[], [itens])
  const base = `/api/flash/pecs/${pecCod}/itens`

  function editar(i: Item) {
    setEditando(i.id)
    setErro(null)
    setForm({
      descricao: i.descricao,
      tipo: i.tipo,
      valorUnitario: formatarNumero(i.valorUnitario, 2).replace(/\./g, ""),
      qtdPadrao: formatarNumero(i.qtdPadrao, Number.isInteger(i.qtdPadrao) ? 0 : 2).replace(/\./g, ""),
      conta: i.conta,
      agrupador: i.agrupador ?? "",
    })
    descricaoRef.current?.focus()
  }

  function cancelar() {
    setEditando(null)
    setForm(VAZIO)
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
        tipo: form.tipo,
        valorUnitario: num(form.valorUnitario || "x"),
        qtdPadrao: form.tipo === "FIXO" && !form.qtdPadrao ? 1 : num(form.qtdPadrao || "0"),
        conta: form.conta ?? "",
        agrupador: form.agrupador || null,
        ordem: ordemAtual,
      }),
    })
    setSalvando(false)
    if (!r.ok) return setErro((await r.json()).error ?? "Falha ao salvar.")
    setEditando(null)
    setForm((f) => ({ ...VAZIO, tipo: f.tipo, conta: f.conta, agrupador: f.agrupador }))
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

  return (
    <div className="space-y-5">
      <form onSubmit={salvar} className="glass space-y-4 rounded-3xl p-5" aria-labelledby="titulo-form-item">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-form-item" className="font-display text-base font-semibold text-navy">
            {editando ? "Editar item" : "Novo item cobrado"}
          </h2>
          {editando && (
            <button type="button" onClick={cancelar} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
              <X className="h-4 w-4" aria-hidden /> Cancelar edição
            </button>
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">Como é cobrado</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {TIPOS_ORDEM.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={form.tipo === t}
                onClick={() => setForm((f) => ({ ...f, tipo: t, conta: f.conta ?? TIPOS[t].contaSugerida }))}
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
              placeholder={form.tipo === "PESSOAS" ? "Ex.: Separador 1º turno" : form.tipo === "UNITARIO" ? "Ex.: Locação de caminhão" : "Ex.: Hora extra 50%"}
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
          <div className="md:col-span-2 flex items-end">
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
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Conta do DRE</span>
            <Combobox value={form.conta} onChange={(v) => setForm({ ...form, conta: v })} options={opcoesConta} placeholder="Busque pelo código ou nome da conta" ariaLabel="Conta do DRE" />
          </div>
        </div>
        {erro && (
          <p role="alert" className="text-sm text-red-700">
            {erro}
          </p>
        )}
      </form>

      {itens.length === 0 ? (
        <p className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
          Nenhum item cadastrado ainda. Comece pelas funções do contrato (tarifa × pessoas) e depois inclua hora extra, variáveis e descontos.
        </p>
      ) : (
        <div className="glass overflow-x-auto rounded-3xl">
          <table className="w-full text-sm">
            <caption className="sr-only">Itens cobrados do PEC</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-medium">Item</th>
                <th scope="col" className="px-3 py-3 font-medium">Tipo</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Valor unit.</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Qtd. padrão</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Mês (padrão)</th>
                <th scope="col" className="px-3 py-3 font-medium">Conta</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id} className={cn("border-t border-navy/5", !i.ativo && "opacity-50", editando === i.id && "bg-teal-tint/60")}>
                  <th scope="row" className="px-5 py-2.5 text-left font-normal text-navy">
                    {i.descricao}
                    {i.agrupador && <span className="ml-2 text-xs text-muted-foreground">{i.agrupador}</span>}
                    {!i.ativo && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}
                  </th>
                  <td className="px-3 py-2.5 text-muted-foreground">{TIPOS[i.tipo].rotulo}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatarNumero(i.valorUnitario, 2)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatarNumero(i.qtdPadrao, Number.isInteger(i.qtdPadrao) ? 0 : 2)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-navy">
                    {moeda((i.tipo === "DESCONTO" ? -1 : 1) * i.valorUnitario * i.qtdPadrao, 2)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground" title={nomeConta.get(i.conta)}>
                    {i.conta} · {nomeConta.get(i.conta) ?? "—"}
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
    </div>
  )
}
