"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Combobox, type ComboOption } from "@/components/ui/Combobox"

/** Adiciona um PEC da carteira do gestor ao Flash Report. */
export function HabilitarPec() {
  const router = useRouter()
  const [opcoes, setOpcoes] = useState<ComboOption[] | null>(null)
  const [pec, setPec] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetch("/api/flash/pecs")
      .then((r) => r.json())
      .then((j) =>
        setOpcoes((j.pecs ?? []).map((p: { pecCod: string; pecNome: string }) => ({ value: p.pecCod, label: p.pecNome }))),
      )
      .catch(() => setErro("Não foi possível carregar os PECs."))
  }, [])

  async function adicionar() {
    if (!pec) return
    setEnviando(true)
    setErro(null)
    const r = await fetch("/api/flash/pecs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pecCod: pec }),
    })
    setEnviando(false)
    if (!r.ok) return setErro((await r.json()).error ?? "Falha ao adicionar.")
    router.push(`/dashboards/financeiro/flash-report/${pec}?aba=parametrizacao`)
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <Combobox
          value={pec}
          onChange={setPec}
          options={opcoes ?? []}
          placeholder={opcoes ? "Busque pelo código ou nome do PEC" : "Carregando PECs…"}
          ariaLabel="Adicionar PEC da sua carteira"
        />
      </div>
      <button
        type="button"
        onClick={adicionar}
        disabled={!pec || enviando}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-inhaus-grad px-4 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="h-4 w-4" aria-hidden />
        {enviando ? "Adicionando…" : "Adicionar"}
      </button>
      {erro && (
        <p role="alert" className="text-sm text-destructive sm:basis-full">
          {erro}
        </p>
      )}
    </div>
  )
}
