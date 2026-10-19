"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, Loader2, X, CheckCircle2 } from "lucide-react"

export function ImportarExcelConformidade() {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [aberto, setAberto] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState("")
  const [sucesso, setSucesso] = useState("")

  async function importar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!arquivo || enviando) return
    setErro(""); setSucesso("")
    if (!arquivo.name.toLowerCase().endsWith(".xlsx") || arquivo.size > 4 * 1024 * 1024) {
      setErro("Selecione um arquivo .xlsx de até 4 MB."); return
    }
    setEnviando(true)
    try {
      const form = new FormData(); form.append("arquivo", arquivo)
      const resposta = await fetch("/api/conformidade-legal/importar", { method: "POST", body: form })
      const resultado = await resposta.json().catch(() => ({ error: "Não foi possível processar a importação. Tente novamente." }))
      if (!resposta.ok) throw new Error(resultado.error || "Não foi possível importar o arquivo.")
      const fmt = new Intl.NumberFormat("pt-BR")
      setSucesso(resultado.duplicado ? "Os dados já estão importados. Nenhum registro foi duplicado." : `${fmt.format(resultado.registros)} registros importados · ${fmt.format(resultado.ocorrencias)} ocorrências · ${fmt.format(resultado.totaisRemovidos)} totais e subtotais excluídos.${resultado.competenciasIgnoradas?.length ? ` Períodos sem alterações: ${resultado.competenciasIgnoradas.length}.` : ""}`)
      setArquivo(null)
      if (input.current) input.current.value = ""
      router.refresh()
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível importar o arquivo.") }
    finally { setEnviando(false) }
  }

  return <div className="min-w-0 space-y-3">
    <button type="button" aria-expanded={aberto} aria-controls="importacao-conformidade" onClick={() => setAberto(!aberto)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-navy/15 bg-white px-3 text-sm font-medium text-navy hover:bg-teal-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"><Upload className="h-4 w-4" aria-hidden="true" />Importar Excel</button>
    {aberto && <form id="importacao-conformidade" onSubmit={importar} aria-busy={enviando} className="rounded-xl border border-navy/15 bg-white/80 p-4">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-navy">Importar conformidade legal</h2><p className="mt-1 text-xs text-muted-foreground">Envie os períodos completos no modelo original (.xlsx, até 4 MB). Dados iguais serão ignorados; períodos alterados serão substituídos.</p></div><button type="button" aria-label="Fechar importação" disabled={enviando} onClick={() => setAberto(false)} className="rounded-md p-1 text-destructive hover:bg-destructive/5 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"><X className="h-4 w-4" /></button></div>
      <div className="mt-4 flex flex-wrap items-end gap-3"><label className="block min-w-0 flex-1 text-xs font-medium text-navy">Arquivo Excel<input ref={input} type="file" accept=".xlsx" disabled={enviando} onChange={(evento) => { setArquivo(evento.target.files?.[0] ?? null); setErro(""); setSucesso("") }} className="mt-1.5 block w-full rounded-lg border border-navy/15 p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-navy disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal" /></label><button type="submit" disabled={!arquivo || enviando} className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2">{enviando && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{enviando ? "Importando…" : "Importar arquivo"}</button></div>
      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      {sucesso && <p role="status" className="mt-3 flex items-start gap-2 text-sm text-teal"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{sucesso}</p>}
    </form>}
  </div>
}

