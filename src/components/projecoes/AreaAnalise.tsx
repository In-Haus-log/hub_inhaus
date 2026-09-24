"use client"

import * as React from "react"

import { DetalheLancamentos } from "@/components/projecoes/DetalheLancamentos"
import { TabelaDinamica, type AlvoDetalhe } from "@/components/projecoes/TabelaDinamica"
import type { No } from "@/lib/projecoes/calculos"
import type { EstadoAnalise } from "@/lib/projecoes/parametros"

export function AreaAnalise(props: { estado: EstadoAnalise; colunas: string[]; raiz: No[]; totais: No }) {
  const [detalhe, setDetalhe] = React.useState<AlvoDetalhe | null>(null)
  return (
    <>
      <TabelaDinamica {...props} onAbrirDetalhe={setDetalhe} />
      {detalhe && <DetalheLancamentos estado={props.estado} alvo={detalhe} onFechar={() => setDetalhe(null)} />}
    </>
  )
}
