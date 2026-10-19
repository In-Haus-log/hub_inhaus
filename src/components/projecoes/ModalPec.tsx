"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { nomeDoPec } from "@/components/flash/moeda"
import { tituloNome } from "@/lib/nomes"
import type { Item } from "@/lib/flash/calculos"
import type { Periodo } from "@/lib/flash/semanas"
import type { LinhaPec } from "@/lib/projecoes/agrupar"
import { ParametrizacaoPec } from "./ParametrizacaoPec"
import { LancamentoSemanaPec } from "./LancamentoSemanaPec"
import { ParametrizacaoInfo } from "./ParametrizacaoInfo"

type Contexto = { pec: { crCod: string }; itens: Item[]; crs: { cr: string; nome: string }[]; podeLancar: boolean; podeParametrizar: boolean }
export function ModalPec({ pec, periodo, onClose }: { pec: LinhaPec | null; periodo: Periodo; onClose: () => void }) {
  const router = useRouter()
  const [dados, setDados] = useState<Contexto | null>(null)
  const [erro, setErro] = useState("")
  const [tentativa, setTentativa] = useState(0)
  const [lancando, setLancando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [alterado, setAlterado] = useState(false)
  useEffect(() => {
    setDados(null); setErro(""); setLancando(false); setAlterado(false)
    if (!pec) return
    const controller = new AbortController()
    fetch(`/api/projecoes/pecs/${encodeURIComponent(pec.pecCod)}/parametrizacao`, { signal: controller.signal, cache: "no-store" })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Não foi possível abrir o contrato."); return d })
      .then(setDados).catch(e => { if (e.name !== "AbortError") setErro(e.message) })
    return () => controller.abort()
  }, [pec?.pecCod, tentativa])
  function fechar() {
    if (ocupado) return
    if (alterado && !window.confirm("Descartar as alterações ainda não salvas?")) return
    onClose(); router.refresh()
  }
  return <Dialog open={!!pec} onOpenChange={open => { if (!open) fechar() }}>
    <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[1600px] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-[94dvh] sm:max-h-[94dvh] sm:w-[calc(100%-2rem)] sm:rounded-3xl" onEscapeKeyDown={e => { if (ocupado) e.preventDefault() }} onInteractOutside={e => e.preventDefault()}>
      <DialogHeader className="shrink-0 border-b border-navy/10 px-4 py-4 pr-12 sm:px-6">
        <div className="flex items-center gap-3"><DialogTitle>{pec ? tituloNome(nomeDoPec(pec.pecNome)) : "Contrato"}</DialogTitle><ParametrizacaoInfo /></div>
        <DialogDescription>PEC {pec?.pecCod} · {dados ? `${dados.crs.length} CR${dados.crs.length === 1 ? "" : "s"}` : "CRs do contrato"} · {lancando ? `Lançamento — semana ${periodo.semana} · ${periodo.mes}` : "Parametrização do contrato"}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {erro ? <div role="alert" className="py-8 text-center"><p>{erro}</p><button className="mt-3 text-teal underline" onClick={() => setTentativa(t => t + 1)}>Tentar novamente</button></div> : !dados ? <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Carregando contrato…</div> : pec && <>
          <details open className="mb-5 rounded-2xl border border-navy/10 bg-navy-mist/40 p-4"><summary className="cursor-pointer text-sm font-semibold text-navy">CRs do PEC ({dados.crs.length})</summary><ul aria-label="CRs vinculados ao PEC" className="mt-3 grid max-h-48 grid-cols-1 gap-x-6 gap-y-2 overflow-y-auto text-sm sm:grid-cols-2 xl:grid-cols-3">{dados.crs.map(c => <li key={c.cr} className="flex min-w-0 gap-2"><strong className="shrink-0 font-medium text-teal">{c.cr}</strong><span className="text-muted-foreground">{c.nome}</span></li>)}</ul></details>
          {lancando ? <><button disabled={ocupado} className="mb-4 flex items-center gap-2 text-sm text-teal" onClick={() => { if (!alterado || window.confirm("Descartar as alterações ainda não salvas?")) { setLancando(false); setAlterado(false) } }}><ArrowLeft className="h-4 w-4" />Parametrização</button><LancamentoSemanaPec pecCod={pec.pecCod} periodo={periodo} onBusy={setOcupado} onDirty={setAlterado} /></> : <ParametrizacaoPec pecCod={pec.pecCod} crPadrao={dados.pec.crCod} itens={dados.itens} crs={dados.crs} podeEditar={dados.podeParametrizar} onBusy={setOcupado} onDirty={setAlterado} />}
        </>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-navy/10 bg-navy-mist/40 px-6 py-4">
        <button disabled={ocupado} onClick={fechar} className="rounded-xl border border-navy/15 px-4 py-2 text-sm text-navy disabled:opacity-50">Fechar</button>
        {!lancando && dados?.podeLancar && <button disabled={ocupado || alterado} onClick={() => setLancando(true)} className="rounded-xl bg-inhaus-grad px-5 py-2 text-sm font-medium text-white shadow-glow disabled:opacity-50">Lançar Semana</button>}
      </div>
    </DialogContent>
  </Dialog>
}
