"use client"

import * as React from "react"
import { Download, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { AlvoDetalhe } from "@/components/projecoes/TabelaDinamica"
import { formatarNumero } from "@/lib/format"
import type { Lancamento } from "@/lib/projecoes/csv"
import { escreverEstado, rotuloMes, type EstadoAnalise } from "@/lib/projecoes/parametros"

type Resposta = { linhas: Lancamento[]; total: number; tamanhoPagina: number }

export function DetalheLancamentos({
  estado,
  alvo,
  onFechar,
}: {
  estado: EstadoAnalise
  alvo: AlvoDetalhe
  onFechar: () => void
}) {
  const [pagina, setPagina] = React.useState(1)
  const [dados, setDados] = React.useState<Resposta | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  const consulta = React.useMemo(() => {
    const sp = escreverEstado(estado)
    alvo.caminho.forEach((c) => sp.append("c", c))
    if (alvo.mes) sp.set("mes", alvo.mes)
    return sp
  }, [estado, alvo])

  React.useEffect(() => {
    let vivo = true
    setDados(null)
    setErro(null)
    const sp = new URLSearchParams(consulta)
    sp.set("pagina", String(pagina))
    fetch(`/api/projecoes/lancamentos?${sp.toString()}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? "Falha ao carregar os lançamentos")
        if (vivo) setDados(d as Resposta)
      })
      .catch((e: Error) => vivo && setErro(e.message))
    return () => {
      vivo = false
    }
  }, [consulta, pagina])

  const csv = new URLSearchParams(consulta)
  csv.set("formato", "csv")
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / dados.tamanhoPagina)) : 1

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-navy">{alvo.titulo}</DialogTitle>
          <DialogDescription>
            Lançamentos {alvo.mes ? `de ${rotuloMes(alvo.mes)}` : "do período"} que formam este número
            {dados ? ` · ${formatarNumero(dados.total)} lançamentos` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto rounded-xl border border-border">
          {erro ? (
            <p role="alert" className="p-4 text-sm text-destructive">{erro}</p>
          ) : !dados ? (
            <p className="p-4 text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
              Carregando…
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-navy-mist text-left text-navy">
                <tr>
                  <th scope="col" className="px-2 py-1.5">Mês</th>
                  <th scope="col" className="px-2 py-1.5">Conta</th>
                  <th scope="col" className="px-2 py-1.5">CR</th>
                  <th scope="col" className="px-2 py-1.5">Histórico</th>
                  <th scope="col" className="px-2 py-1.5">Lote</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Realizado</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Orçado</th>
                </tr>
              </thead>
              <tbody>
                {dados.linhas.map((l, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="whitespace-nowrap px-2 py-1">{rotuloMes(l.mes)}</td>
                    <td className="px-2 py-1">{l.conta} - {l.desc_conta}</td>
                    <td className="px-2 py-1">{l.cr}</td>
                    <td className="px-2 py-1">{l.historico ?? "—"}</td>
                    <td className="px-2 py-1">{l.lote ?? "—"}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatarNumero(l.realizado, 2)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatarNumero(l.orcado, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-navy">
            <Button type="button" variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </Button>
            <span>
              Página {pagina} de {paginas}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
              Próxima
            </Button>
          </div>
          <Button asChild variant="gradient" size="sm">
            <a href={`/api/projecoes/lancamentos?${csv.toString()}`} download>
              <Download className="mr-1.5 h-4 w-4" aria-hidden />
              Exportar para Excel
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
