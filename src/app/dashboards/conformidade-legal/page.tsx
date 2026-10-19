import type { Metadata } from "next"
import { ShieldCheck, Clock3 } from "lucide-react"
import { assertTelaVisivel, resolverPapeisDashboard } from "@/lib/dashboard-acesso"
import { ImportarExcelConformidade } from "@/components/conformidade-legal/ImportarExcelConformidade"
import { escopoConformidadeAtual } from "@/lib/conformidade-legal-acesso"
import { lerFiltrosConformidade } from "@/lib/conformidade-legal-filtros"
import { getConformidadeLegal, type DadosConformidadeLegal } from "@/lib/conformidade-legal"
import { DashboardConformidadeLegal } from "@/components/conformidade-legal/DashboardConformidadeLegal"
import { InfoIndicador } from "@/components/dashboard/InfoIndicador"

export const metadata: Metadata = { title: "Conformidade legal" }
export const dynamic = "force-dynamic"

export default async function ConformidadeLegalPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await assertTelaVisivel("conformidade-legal")
  const { isAdmin } = await resolverPapeisDashboard("/dashboards/conformidade-legal")
  let dados: DadosConformidadeLegal | null = null
  try {
    dados = await getConformidadeLegal(await escopoConformidadeAtual())
  } catch {
    console.error("Falha ao consultar conformidade legal.")
  }
  const atualizado = dados?.atualizadoEm
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
      }).format(new Date(dados.atualizadoEm))
    : null

  return (
    <div className="conformidade-legal space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="eyebrow"><ShieldCheck className="h-3.5 w-3.5" /> In-Haus</span>
          <div className="mt-3 flex items-center gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Conformidade legal</h1>
            <InfoIndicador titulo="Conformidade legal">
              <p><b>O que mostra:</b> ocorrências registradas de jornada, descanso e férias no período selecionado.</p>
              <ul className="list-disc space-y-2 pl-5">
                <li><b>Ocorrências:</b> soma dos registros detalhados. Totais e subtotais da origem ficam fora da contagem.</li>
                <li><b>Tipos:</b> interjornada, limite de horas diárias, exceções de horas diárias, folga semanal, limite de folgas trabalhadas na escala 12×36 e férias com ponto.</li>
                <li><b>Participação:</b> ocorrências do tipo divididas pelo total do recorte. Exemplo: 20 de 100 ocorrências representam 20%.</li>
                <li><b>Pessoas e CRs:</b> contados uma única vez no recorte, considerando quem tem ocorrências. Pessoas sem identificação disponível ficam fora da contagem distinta. Uma pessoa pode aparecer em vários meses e tipos.</li>
                <li><b>Filtros:</b> inicialmente entram todos os períodos e CRs disponíveis para quem tem acesso ao indicador. A seleção de um tipo direciona os gráficos e o detalhamento; os cards continuam mostrando o recorte dos filtros.</li>
                <li><b>Detalhamento:</b> abre uma tela com os mesmos filtros. Escolha o agrupamento e expanda as linhas para consultar os níveis seguintes até os registros. O total de pessoas conta cada pessoa uma única vez, mesmo que apareça em vários grupos.</li>
                <li>Os períodos podem estar incompletos. Um volume menor não indica, por si só, melhora da conformidade.</li>
              </ul>
              <p>A participação dos tipos não representa uma taxa de conformidade do quadro total. Valores de processos e valores financeiros não entram nestes indicadores.</p>
            </InfoIndicador>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Acompanhamento de ocorrências por período, CR e função.</p>
        </div>
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <Clock3 className="h-4 w-4 shrink-0" />
          <div><p>Última atualização</p><p className="mt-1 font-medium text-foreground">{atualizado ?? "Não disponível"}</p></div>
        </div>
      </header>
      {isAdmin && <ImportarExcelConformidade />}
      {!dados ? (
        <section role="alert" className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
          <p className="font-semibold">Não foi possível carregar a conformidade legal.</p>
          <p className="mt-1">Atualize a página para tentar novamente.</p>
        </section>
      ) : <DashboardConformidadeLegal dados={dados} filtrosIniciais={lerFiltrosConformidade(searchParams)} />}
    </div>
  )
}


