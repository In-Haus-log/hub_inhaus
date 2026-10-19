"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Trash2, LayoutDashboard, RefreshCw, Pencil, ExternalLink } from "lucide-react"
import { ICONES_BI, ICONE_BI_PADRAO, type IconeBi } from "@/lib/powerbi-icones"
import { iconeDoBi } from "@/components/powerbi/icones"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InfoIndicador } from "@/components/dashboard/InfoIndicador"

type Painel = { id: number; clienteId: number; titulo: string; url: string; documentacao?: string; icone?: string }
type Cliente = { id: number; nome: string; slug: string }
type Resposta = { clientes?: Cliente[]; paineis?: Painel[] }

export function GerenciadorPowerBi({ podeGerenciar, clienteId, modo = "relatorios", clienteInicialId, painelId }: { podeGerenciar: boolean; clienteId?: number; modo?: "clientes" | "relatorios"; clienteInicialId?: number; painelId?: number }) {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<number | null>(clienteId ?? clienteInicialId ?? null)
  const [paineis, setPaineis] = useState<Painel[]>([])
  const [selecionado, setSelecionado] = useState<number | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState("")
  const [formPainel, setFormPainel] = useState(false)
  const [editandoPainel, setEditandoPainel] = useState<Painel | null>(null)
  const [tituloPainel, setTituloPainel] = useState("")
  const [urlPainel, setUrlPainel] = useState("")
  const [documentacaoPainel, setDocumentacaoPainel] = useState("")
  const [iconePainel, setIconePainel] = useState<IconeBi>(ICONE_BI_PADRAO)
  const [salvo, setSalvo] = useState(false)
  const [formCliente, setFormCliente] = useState(false)
  const [nomeCliente, setNomeCliente] = useState("")

  useEffect(() => {
    if (clienteId !== undefined) {
      setClienteSelecionado(clienteId)
      setSelecionado(null)
    }
  }, [clienteId])

  const carregar = useCallback(async (clienteForcado?: number) => {
    setCarregando(true)
    setErro("")
    try {
      const response = await fetch("/api/powerbi", { cache: "no-store" })
      if (!response.ok) throw new Error("Não foi possível carregar os painéis.")
      const data = (await response.json()) as Resposta
      const clientesLista = Array.isArray(data.clientes) ? data.clientes : []
      const paineisLista = Array.isArray(data.paineis) ? data.paineis : []
      setClientes(clientesLista)
      setPaineis(paineisLista)
      const idCliente = clienteId ?? clienteForcado ?? clienteSelecionado ?? clienteInicialId ?? clientesLista[0]?.id ?? null
      if (clienteId === undefined) setClienteSelecionado(idCliente)
      const lista = paineisLista.filter((p) => p.clienteId === idCliente)
      setSelecionado((atual) => painelId !== undefined
        ? lista.some((p) => p.id === painelId) ? painelId : null
        : atual && lista.some((p) => p.id === atual) ? atual : lista[0]?.id ?? null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Ocorreu um erro ao carregar os painéis.")
    } finally {
      setCarregando(false)
    }
  }, [clienteId, clienteInicialId, clienteSelecionado, painelId])

  useEffect(() => { void carregar() }, [carregar])

  const paineisDoCliente = useMemo(() => paineis.filter((p) => p.clienteId === clienteSelecionado), [paineis, clienteSelecionado])
  const painelAtual = useMemo(() => paineis.find((p) => p.id === selecionado && p.clienteId === (clienteId ?? clienteSelecionado)) ?? null, [paineis, selecionado, clienteId, clienteSelecionado])
  const consultaIndividual = clienteId !== undefined

  function limparFormularioPainel() {
    setFormPainel(false)
    setEditandoPainel(null)
    setTituloPainel("")
    setUrlPainel("")
    setDocumentacaoPainel("")
    setIconePainel(ICONE_BI_PADRAO)
    setSalvo(false)
  }

  async function salvarPainel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clienteDoFormulario = clienteSelecionado
    if (clienteDoFormulario === null) return
    const painelEmEdicao = editandoPainel
    if (painelEmEdicao && painelEmEdicao.clienteId !== clienteDoFormulario) return
    await mutar({ ...(painelEmEdicao ? { id: painelEmEdicao.id } : {}), clienteId: clienteDoFormulario, titulo: tituloPainel.trim(), url: urlPainel.trim(), documentacao: documentacaoPainel.trim(), icone: iconePainel }, painelEmEdicao ? "PATCH" : "POST", limparFormularioPainel)
  }

  async function criarCliente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSalvando(true)
    setErro("")
    try {
      const response = await fetch("/api/powerbi/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: nomeCliente.trim() }) })
      const data = await response.json() as { cliente?: Cliente; error?: string; message?: string }
      if (!response.ok || !data.cliente) throw new Error(data.error || data.message || "Não foi possível criar o cliente.")
      setNomeCliente("")
      setFormCliente(false)
      if (modo !== "clientes") setClienteSelecionado(data.cliente.id)
      setClientes((atuais) => [...atuais.filter((c) => c.id !== data.cliente!.id), data.cliente!])
      router.refresh()
      if (modo !== "clientes") await carregar(data.cliente.id)
    } catch (e) { setErro(e instanceof Error ? e.message : "Ocorreu um erro ao criar o cliente.") }
    finally { setSalvando(false) }
  }

  function trocarCliente(id: number) {
    setClienteSelecionado(id)
    setSelecionado(null)
    limparFormularioPainel()
  }

  async function mutar(body: Record<string, string | number>, method: "POST" | "PATCH" = "POST", depois?: () => void) {
    setSalvando(true)
    setErro("")
    setSalvo(false)
    try {
      const response = await fetch("/api/powerbi", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!response.ok) {
        let detalhe = ""
        try { const data = await response.json() as { error?: string; message?: string }; detalhe = data.error || data.message || "" } catch { /* resposta sem JSON */ }
        throw new Error(detalhe || "Não foi possível salvar. Confira os dados e tente novamente.")
      }
      depois?.()
      setSalvo(true)
      router.refresh()
      await carregar()
    } catch (e) { setErro(e instanceof Error ? e.message : "Ocorreu um erro ao salvar.") }
    finally { setSalvando(false) }
  }

  async function excluirPainel(id: number, nome: string) {
    if (!window.confirm(`Excluir o relatório “${nome}”? Essa ação não pode ser desfeita.`)) return
    setSalvando(true)
    setErro("")
    try {
      const response = await fetch(`/api/powerbi?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Não foi possível excluir. Tente novamente.")
      router.refresh()
      await carregar()
    } catch (e) { setErro(e instanceof Error ? e.message : "Ocorreu um erro ao excluir.") }
    finally { setSalvando(false) }
  }

  return (
    <section className="space-y-4" aria-label="Painéis Power BI">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            {consultaIndividual && <p className="text-xs font-medium text-muted-foreground">{clientes.find(c => c.id === clienteId)?.nome ?? "Cliente"}</p>}
            <h1 className="min-w-0 break-words text-lg font-semibold text-navy">{modo === "clientes" ? "Clientes" : consultaIndividual ? painelAtual?.titulo ?? "Relatório BI" : "Relatórios"}</h1>
          </div>
          {consultaIndividual ? !carregando && painelAtual && <InfoIndicador titulo="Documentação do relatório"><p className="whitespace-pre-wrap break-words">{painelAtual.documentacao?.trim() || "A documentação deste relatório ainda não foi informada."}</p></InfoIndicador> : <InfoIndicador titulo="Sobre os painéis Power BI"><p>Os relatórios publicados no Power BI ficam disponíveis para consulta conforme o acesso de cada cliente.</p></InfoIndicador>}
        </div>
        {modo === "relatorios" && clienteId === undefined && clientes.length > 0 && <label className="min-w-48 space-y-1 text-xs font-medium text-muted-foreground">Cliente<select aria-label="Cliente" value={clienteSelecionado ?? ""} onChange={(e) => trocarCliente(Number(e.target.value))} disabled={salvando} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>}
        {podeGerenciar && modo === "clientes" && clienteId === undefined && <Button type="button" variant="outline" size="sm" onClick={() => setFormCliente((v) => !v)}><Plus /> Novo cliente</Button>}
        {podeGerenciar && modo === "relatorios" && !consultaIndividual && clienteSelecionado !== null && <Button type="button" size="sm" disabled={salvando} onClick={() => { limparFormularioPainel(); setFormPainel(true) }}><Plus /> Novo relatório</Button>}
      </header>

      {formCliente && podeGerenciar && modo === "clientes" && clienteId === undefined && <form onSubmit={criarCliente} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:max-w-xl sm:flex-row sm:items-end"><label className="min-w-0 flex-1 space-y-1 text-sm font-medium">Nome do cliente<Input autoFocus value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} required maxLength={120} disabled={salvando} /></label><div className="flex gap-2"><Button type="submit" size="sm" disabled={salvando}>Criar cliente</Button><Button type="button" size="sm" variant="ghost" disabled={salvando} onClick={() => setFormCliente(false)}>Cancelar</Button></div></form>}

      {modo === "clientes" && clienteId === undefined && <div className="divide-y divide-border border-y border-border">{carregando ? <div className="h-14 animate-pulse bg-muted/50" aria-label="Carregando clientes" /> : clientes.length ? clientes.map((c) => <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="min-w-0 truncate text-sm font-medium text-foreground">{c.nome}</span><div className="flex shrink-0 items-center gap-4 text-sm"><Link href={`/dashboards/administracao/relatorios?cliente=${c.id}`} className="text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Relatórios</Link><Link href={`/dashboards/clientes/bi/${c.id}`} className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Visualizar projetos</Link></div></div>) : <div className="py-10 text-center text-sm text-muted-foreground">{podeGerenciar ? "Nenhum cliente cadastrado ainda." : "Nenhum cliente disponível."}</div>}</div>}

      {erro && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{erro}<Button type="button" variant="ghost" size="sm" onClick={() => void carregar()}><RefreshCw /> Recarregar</Button></div>}
      {modo === "relatorios" && clientes.length === 0 && !carregando && clienteId === undefined && podeGerenciar && <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado. <Link href="/dashboards/administracao/clientes" className="font-medium text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cadastrar cliente</Link></p>}

      {modo === "relatorios" && <>
        {consultaIndividual && (carregando ? <div className="h-72 animate-pulse rounded-lg bg-muted" aria-label="Carregando relatório" /> : painelAtual
          ? <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background"><iframe key={painelAtual.id} src={painelAtual.url} title={painelAtual.titulo} referrerPolicy="no-referrer" allowFullScreen className="block aspect-video min-h-[360px] w-full border-0 lg:min-h-[560px]" /></div>
          : <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center"><LayoutDashboard className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" /><p className="text-sm font-medium text-foreground">{paineis.some((p) => p.clienteId === clienteId) ? "Relatório indisponível" : "Nenhum painel disponível"}</p><p className="mt-1 text-sm text-muted-foreground">Os relatórios disponíveis aparecerão aqui.</p></div>)}
        {!consultaIndividual && <>
          {(formPainel || editandoPainel) && podeGerenciar && <form onSubmit={salvarPainel} className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2" aria-label={editandoPainel ? "Editar relatório" : "Novo relatório"}>
            <h2 className="text-base font-semibold text-navy sm:col-span-2">{editandoPainel ? "Editar relatório" : "Novo relatório"}</h2>
            <label className="space-y-1 text-sm font-medium text-foreground sm:col-span-2">Título<Input autoFocus value={tituloPainel} onChange={(e) => setTituloPainel(e.target.value)} placeholder="Ex.: Indicadores mensais" required maxLength={120} disabled={salvando} /></label>
            <fieldset disabled={salvando} className="min-w-0 space-y-2 sm:col-span-2">
              <legend className="mb-2 text-sm font-medium text-foreground">Ícone na sidebar</legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Ícone na sidebar">
                {ICONES_BI.map(({ value, label }) => {
                  const Icone = iconeDoBi(value)
                  const ativo = iconePainel === value
                  return <button key={value} type="button" aria-label={label} aria-pressed={ativo} title={label} onClick={() => setIconePainel(value)} className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${ativo ? "border-teal bg-teal/10 text-teal" : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icone className="h-4 w-4" aria-hidden="true" /></button>
                })}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>Selecionado: {ICONES_BI.find(({ value }) => value === iconePainel)?.label}</span><span aria-hidden="true">·</span><span>Prévia</span>{(() => { const Icone = iconeDoBi(iconePainel); return <span className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-sm font-medium text-foreground"><Icone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{tituloPainel.trim() || "Título do relatório"}</span> })()}</div>
            </fieldset>
            <label className="space-y-1 text-sm font-medium text-foreground sm:col-span-2">URL do relatório Power BI<Input type="url" value={urlPainel} onChange={(e) => setUrlPainel(e.target.value)} placeholder="https://..." required disabled={salvando} /></label>
            <label className="space-y-1 text-sm font-medium text-foreground sm:col-span-2">Documentação <span className="font-normal text-muted-foreground">(opcional)</span><textarea value={documentacaoPainel} onChange={(e) => setDocumentacaoPainel(e.target.value)} maxLength={20000} disabled={salvando} rows={5} placeholder="Descreva regras de negócio, cálculos, fontes de dados, filtros e periodicidade." className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <p className="text-xs text-muted-foreground sm:col-span-2">{documentacaoPainel.length}/20.000 caracteres</p>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={salvando || !tituloPainel.trim() || !urlPainel.trim() || clienteSelecionado === null}>{salvando ? "Salvando…" : "Salvar relatório"}</Button><Button type="button" variant="outline" disabled={salvando} onClick={limparFormularioPainel}>Cancelar</Button></div>
          </form>}
          {salvo && <p role="status" className="text-sm text-emerald-700">Alterações salvas.</p>}
          {carregando ? <div className="space-y-2" aria-label="Carregando painéis"><div className="h-10 animate-pulse rounded-lg bg-muted"/><div className="h-72 animate-pulse rounded-lg bg-muted"/></div> : paineisDoCliente.length === 0 ? <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center"><LayoutDashboard className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" /><p className="text-sm font-medium text-foreground">Nenhum relatório disponível</p><p className="mt-1 text-sm text-muted-foreground">{clienteSelecionado === null ? "Selecione um cliente para consultar os relatórios." : podeGerenciar ? "Cadastre um relatório para este cliente." : "Os relatórios disponíveis aparecerão aqui."}</p></div> : <div className="min-w-0 overflow-x-auto rounded-lg border border-border bg-background"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground"><tr><th className="px-4 py-3">Título</th><th className="px-4 py-3">Documentação</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-border">{paineisDoCliente.map((painel) => <tr key={painel.id} className="align-top hover:bg-muted/20"><td className="px-4 py-3 font-medium text-foreground"><span className="flex items-center gap-2"><span className="shrink-0 text-muted-foreground" aria-hidden="true">{(() => { const Icone = iconeDoBi(painel.icone); return <Icone className="h-4 w-4" /> })()}</span><span className="break-words">{painel.titulo}</span></span></td><td className="px-4 py-3">{painel.documentacao?.trim() ? <span className="text-emerald-700">Informada</span> : <span className="text-muted-foreground">Pendente</span>}</td><td className="px-4 py-3"><div className="flex justify-end gap-1">{clienteSelecionado !== null && <Link href={`/dashboards/clientes/bi/${clienteSelecionado}/${painel.id}`} aria-label={`Visualizar ${painel.titulo}`} title="Visualizar relatório" className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ExternalLink className="h-4 w-4" /></Link>}{podeGerenciar && <><button type="button" disabled={salvando} onClick={() => { setEditandoPainel(painel); setTituloPainel(painel.titulo); setUrlPainel(painel.url); setDocumentacaoPainel(painel.documentacao ?? ""); setIconePainel((ICONES_BI.some(({ value }) => value === painel.icone) ? painel.icone : ICONE_BI_PADRAO) as IconeBi); setFormPainel(false); setSalvo(false) }} aria-label={`Editar ${painel.titulo}`} title="Editar relatório" className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"><Pencil className="h-4 w-4" /></button><button type="button" disabled={salvando} onClick={() => void excluirPainel(painel.id, painel.titulo)} aria-label={`Excluir ${painel.titulo}`} title="Excluir relatório" className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></>}</div></td></tr>)}</tbody></table></div>}
        </>}
      </>}
    </section>
  )
}
