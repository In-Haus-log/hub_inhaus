"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { DOMINIOS } from "@/lib/domains"
import { idsDeSistemasCliente, sincronizarTelasDeClientes } from "@/lib/usuarios-permissoes-ui"
import { cn } from "@/lib/utils"

type ClientePowerBi = { id: number; nome: string; slug: string }
type Tela = { key: string; label: string }
type GrupoArea = { key: string; titulo: string; telas: Tela[] }
type Props = {
  value: string[]
  onChange: (next: string[]) => void
  contratantes: number[]
  onContratantesChange: (next: number[]) => void
}

const ID_CLIENTE_BI = /^cliente-bi:([1-9]\d*)$/
const CLIENTES_HUB = DOMINIOS.flatMap((dominio) => dominio.clientes ?? [])

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim()
}

function idClienteDaTela(tela: string): number | null {
  const match = ID_CLIENTE_BI.exec(tela)
  if (!match) return null
  const id = Number(match[1])
  return Number.isSafeInteger(id) ? id : null
}

function montarAreas(): GrupoArea[] {
  return [
    ...DOMINIOS.filter((dominio) => !dominio.clientes?.length).map((dominio) => ({
      key: dominio.key,
      titulo: dominio.label,
      telas: dominio.telas.filter((tela) => !tela.emBreve).map(({ key, label }) => ({ key, label })),
    })).filter((area) => area.telas.length > 0),
  ]
}

const AREAS = montarAreas()

export function SeletorTelas({ value, onChange, contratantes, onContratantesChange }: Props) {
  const uid = React.useId()
  const [clientes, setClientes] = React.useState<ClientePowerBi[]>([])
  const [carregando, setCarregando] = React.useState(true)
  const [erro, setErro] = React.useState(false)
  const [busca, setBusca] = React.useState("")

  const carregarClientes = React.useCallback(async () => {
    setCarregando(true)
    setErro(false)
    try {
      const response = await fetch("/api/powerbi/clientes", { cache: "no-store" })
      if (!response.ok) throw new Error("Falha ao carregar clientes")
      const data = (await response.json()) as { clientes?: ClientePowerBi[] }
      if (!Array.isArray(data.clientes)) throw new Error("Resposta inválida")
      setClientes(data.clientes.filter((cliente) => {
        const id = Number(cliente?.id)
        return Number.isSafeInteger(id) && id > 0 && typeof cliente.nome === "string"
      }).map((cliente) => ({ ...cliente, id: Number(cliente.id) })))
    } catch {
      setErro(true)
    } finally {
      setCarregando(false)
    }
  }, [])

  React.useEffect(() => { void carregarClientes() }, [carregarClientes])

  // Preserva as concessões antigas de BI e de sistemas ao editar o usuário.
  const selecionados = React.useMemo(() => Array.from(new Set([
    ...contratantes,
    ...value.map(idClienteDaTela).filter((id): id is number => id !== null),
    ...idsDeSistemasCliente(value, clientes, CLIENTES_HUB),
  ])), [contratantes, value, clientes])
  const termo = normalizar(busca)
  const areasFiltradas = AREAS.filter((area) => !termo || normalizar(`${area.titulo} ${area.telas.map((tela) => tela.label).join(" ")}`).includes(termo))
  const clientesFiltrados = clientes.filter((cliente) => !termo || normalizar(cliente.nome).includes(termo))

  function atualizarClientes(ids: number[]) {
    onContratantesChange(ids)
    onChange(sincronizarTelasDeClientes(value, ids, clientes, CLIENTES_HUB))
  }

  function alternarArea(area: GrupoArea) {
    const todasAtivas = area.telas.every((tela) => value.includes(tela.key))
    const chavesArea = new Set(area.telas.map((tela) => tela.key))
    onChange(todasAtivas
      ? value.filter((chave) => !chavesArea.has(chave))
      : Array.from(new Set([...value, ...chavesArea])))
  }

  function alternarTela(tela: Tela) {
    onChange(value.includes(tela.key)
      ? value.filter((chave) => chave !== tela.key)
      : [...value, tela.key])
  }

  function alternarCliente(id: number) {
    atualizarClientes(selecionados.includes(id)
      ? selecionados.filter((selecionado) => selecionado !== id)
      : [...selecionados, id])
  }

  function alternarTodosClientes() {
    const idsVisiveis = clientesFiltrados.map((cliente) => cliente.id)
    const todosAtivos = idsVisiveis.every((id) => selecionados.includes(id))
    atualizarClientes(todosAtivos
      ? selecionados.filter((id) => !idsVisiveis.includes(id))
      : Array.from(new Set([...selecionados, ...idsVisiveis])))
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Buscar áreas e clientes" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar área ou cliente" className="pl-9" />
      </div>

      <section aria-labelledby={`${uid}-areas`} className="space-y-2">
        <div>
          <h3 id={`${uid}-areas`} className="text-sm font-semibold text-navy">Áreas do hub</h3>
          <p className="text-xs text-muted-foreground">A seleção libera a área inteira, incluindo os indicadores atuais.</p>
        </div>
        {areasFiltradas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma área encontrada.</p> : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {areasFiltradas.map((area) => {
              const habilitadas = area.telas.filter((tela) => value.includes(tela.key)).length
              const estado = habilitadas === area.telas.length ? true : habilitadas > 0 ? "indeterminate" : false
              return (
                <div key={area.key} className="flex items-start gap-2 rounded-xl border border-navy/10 bg-white/55 px-3 py-2.5">
                  <Checkbox aria-label={`Liberar área ${area.titulo}`} checked={estado} onCheckedChange={() => alternarArea(area)} className="mt-0.5" />
                  <details className="group min-w-0 flex-1">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="min-w-0 flex-1 text-sm font-medium text-navy">{area.titulo}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{habilitadas}/{area.telas.length}</span>
                    </summary>
                    <ul className="mt-2 space-y-1 border-t border-navy/8 pt-2 text-xs text-muted-foreground">
                      {area.telas.map((tela) => <li key={tela.key} className="flex items-center gap-2"><Checkbox aria-label={`Liberar ${tela.label}`} checked={value.includes(tela.key)} onCheckedChange={() => alternarTela(tela)} /><span className="text-navy">{tela.label}</span></li>)}
                    </ul>
                  </details>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section aria-labelledby={`${uid}-clientes`} className="space-y-2 border-t border-navy/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id={`${uid}-clientes`} className="text-sm font-semibold text-navy">Clientes</h3>
            <p className="text-xs text-muted-foreground">Cada seleção libera os sistemas atuais do cliente e todos os relatórios, inclusive novos BIs.</p>
          </div>
          <button type="button" onClick={alternarTodosClientes} disabled={carregando || erro || clientesFiltrados.length === 0} className="rounded-md px-2 py-1 text-xs font-medium text-navy underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
            {clientesFiltrados.length > 0 && clientesFiltrados.every((cliente) => selecionados.includes(cliente.id)) ? "Limpar clientes encontrados" : "Selecionar clientes encontrados"}
          </button>
        </div>
        {carregando ? <p role="status" className="text-sm text-muted-foreground">Carregando clientes…</p> : erro ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive"><span>Não foi possível carregar os clientes.</span><button type="button" onClick={() => void carregarClientes()} className="font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Tentar novamente</button></div>
        ) : clientesFiltrados.length === 0 ? <p className="text-sm text-muted-foreground">{clientes.length ? "Nenhum cliente encontrado." : "Nenhum cliente disponível."}</p> : (
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {clientesFiltrados.map((cliente) => {
              const portal = CLIENTES_HUB.find((item) => normalizar(item.label) === normalizar(cliente.nome))
              const portalTelas = portal?.telas.filter((tela) => !tela.emBreve) ?? []
              const concedidas = portalTelas.filter((tela) => value.includes(tela.key)).length
              return (
                <div key={cliente.id} className={cn("rounded-lg px-2 py-1.5 hover:bg-navy/5", selecionados.includes(cliente.id) && "bg-teal-tint/40")}>
                  <div className="flex min-h-9 items-center gap-2 text-sm text-navy">
                    <Checkbox aria-label={`Liberar cliente ${cliente.nome}`} checked={selecionados.includes(cliente.id)} onCheckedChange={() => alternarCliente(cliente.id)} />
                    <span className="min-w-0 flex-1 break-words">{cliente.nome}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">Todos os relatórios</span>
                  </div>
                  {portalTelas.length > 0 && (
                    <details className="ml-6 text-xs text-muted-foreground">
                      <summary className="w-fit cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Sistemas do hub · {concedidas}/{portalTelas.length}</summary>
                      <ul className="mt-1 space-y-1 pb-1 pl-3">{portalTelas.map((tela) => <li key={tela.key}>{tela.label}</li>)}</ul>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
