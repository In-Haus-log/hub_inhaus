"use client"

import * as React from "react"

import { TabelaDinamica, type AlvoDetalhe } from "@/components/projecoes/TabelaDinamica"
import type { No } from "@/lib/projecoes/calculos"
import type { EstadoAnalise } from "@/lib/projecoes/parametros"

export function AreaAnalise(props: { estado: EstadoAnalise; colunas: string[]; raiz: No[]; totais: No }) {
  const [, setDetalhe] = React.useState<AlvoDetalhe | null>(null)
  return <TabelaDinamica {...props} onAbrirDetalhe={setDetalhe} />
}
