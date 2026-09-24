import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"

import { ControlesAnalise } from "@/components/projecoes/ControlesAnalise"
import { ProjecoesInfo } from "@/components/projecoes/ProjecoesInfo"
import { AreaAnalise } from "@/components/projecoes/AreaAnalise"
import { assertTelaVisivel } from "@/lib/dashboard-acesso"
import { escopoDaPagina, TELA_PROJECOES } from "@/lib/projecoes/acesso"
import type { No } from "@/lib/projecoes/calculos"
import {
  getMesesDisponiveis,
  getNivel,
  getSituacaoCarga,
  getTotais,
  type SituacaoCarga,
} from "@/lib/projecoes/dados"
import {
  escreverEstado,
  lerEstado,
  mesesEntre,
  paraURLSearchParams,
  periodoPadrao,
} from "@/lib/projecoes/parametros"

export const metadata: Metadata = { title: "Projeções" }

// Lê a base a cada requisição (sem prerender no build).
export const dynamic = "force-dynamic"

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

export default async function ProjecoesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  await assertTelaVisivel(TELA_PROJECOES)
  const escopo = await escopoDaPagina()
  const estado = lerEstado(paraURLSearchParams(searchParams))

  let meses: string[] = []
  let carga: SituacaoCarga | null = null
  let raiz: No[] = []
  let totais: No | null = null
  let erro: string | null = null

  try {
    ;[meses, carga] = await Promise.all([getMesesDisponiveis(escopo), getSituacaoCarga()])
    estado.periodo ??= periodoPadrao(meses)
    if (estado.periodo) {
      const recorte = { periodo: estado.periodo, filtros: estado.filtros, caminho: [] }
      ;[raiz, totais] = await Promise.all([getNivel(estado.niveis[0], recorte, escopo), getTotais(recorte, escopo)])
    }
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha ao consultar a base do Projeções."
  }

  const colunas = estado.periodo ? mesesEntre(estado.periodo.de, estado.periodo.ate) : []
  const chaveTabela = escreverEstado(estado).toString()

  return (
    <div className="space-y-6">
      <section className="reveal">
        <span className="eyebrow">Financeiro</span>
        <div className="mt-3 flex items-center gap-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-navy">Projeções</h1>
          <ProjecoesInfo />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Realizado × Orçado por conta, CR, gerente e demais recortes — monte a análise empilhando os níveis.
        </p>
      </section>

      {erro ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </div>
      ) : !estado.periodo || !totais || meses.length === 0 ? (
        <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
          Ainda não há lançamentos carregados para a sua carteira. Assim que a primeira carga do
          relatório Realizado × Orçado for feita, a análise aparece aqui.
        </div>
      ) : (
        <>
          <ControlesAnalise estado={estado} meses={meses} />
          <AreaAnalise key={chaveTabela} estado={estado} colunas={colunas} raiz={raiz} totais={totais} />
        </>
      )}

      <footer className="space-y-1 text-xs text-muted-foreground">
        {carga?.atualizadoEm && <p>Dados atualizados em {dataHora(carga.atualizadoEm)}.</p>}
        {carga?.erro && escopo.tipo === "todos" && (
          <p role="status" className="text-red-600">
            A última atualização falhou em {dataHora(carga.erro.em)}: {carga.erro.mensagem ?? "sem detalhe"}. A
            tela mostra os dados da última carga concluída.
          </p>
        )}
      </footer>
    </div>
  )
}
