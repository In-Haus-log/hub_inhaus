"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RotateCcw } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/** Financeiro reabre uma semana enviada; o motivo fica registrado. */
export function ReabrirSemana({ pecCod, mes, semana, rotulo }: { pecCod: string; mes: string; semana: number; rotulo: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function reabrir(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    const r = await fetch(`/api/flash/pecs/${pecCod}/semanas/${mes}/${semana}/reabrir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    })
    setEnviando(false)
    if (!r.ok) return setErro((await r.json()).error ?? "Falha ao reabrir.")
    setAberto(false)
    setMotivo("")
    router.refresh()
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        aria-label={`Reabrir semana ${semana} de ${rotulo}`}
        className="rounded-md p-1 text-muted-foreground opacity-60 transition hover:bg-navy-mist hover:text-navy hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={reabrir} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Reabrir a semana {semana}?</DialogTitle>
            <DialogDescription>
              {rotulo} volta a ficar editável para o gestor, que precisará enviar de novo. O motivo fica registrado.
            </DialogDescription>
          </DialogHeader>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Motivo</span>
            <textarea
              required
              minLength={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/30"
              placeholder="Ex.: hora extra lançada em duplicidade"
            />
          </label>
          {erro && (
            <p role="alert" className="text-sm text-red-700">
              {erro}
            </p>
          )}
          <DialogFooter>
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-inhaus-grad px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
              Reabrir
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
