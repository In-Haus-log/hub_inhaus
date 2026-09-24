"use client"

import * as React from "react"

import { type ComboOption } from "@/components/ui/Combobox"
import { MultiCombobox } from "@/components/ui/MultiCombobox"

type Resposta = { crs: { cr: string; descricao: string | null }[] }

/**
 * Escopo de DADOS por CR (Eixo 2): quais CRs o usuário enxerga nos indicadores por CR
 * (ex.: RE x OR). Gerente = os CRs da carteira dele. Admin interno vê todos.
 */
export function SeletorCrs({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [opcoes, setOpcoes] = React.useState<ComboOption[]>([])
  const [erro, setErro] = React.useState<string | null>(null)

  React.useEffect(() => {
    let vivo = true
    fetch("/api/admin/clientes-crs", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Resposta>) : Promise.reject(new Error("Falha ao carregar os CRs"))))
      .then((d) => {
        if (vivo) setOpcoes(d.crs.map((c) => ({ value: c.cr, label: c.descricao ? `${c.cr} - ${c.descricao}` : c.cr })))
      })
      .catch((e: Error) => vivo && setErro(e.message))
    return () => {
      vivo = false
    }
  }, [])

  return (
    <div>
      <MultiCombobox
        values={value}
        onChange={onChange}
        options={opcoes}
        placeholder="Nenhum CR vinculado"
        ariaLabel="CRs cujos dados o usuário pode ver"
      />
      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
    </div>
  )
}
