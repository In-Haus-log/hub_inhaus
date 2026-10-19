import type { Metadata } from "next"
import { TableProperties } from "lucide-react"
import { assertTelaVisivel } from "@/lib/dashboard-acesso"
import { escopoConformidadeAtual } from "@/lib/conformidade-legal-acesso"
import { getConformidadeLegal, type DadosConformidadeLegal } from "@/lib/conformidade-legal"
import { lerFiltrosConformidade } from "@/lib/conformidade-legal-filtros"
import { InfoIndicador } from "@/components/dashboard/InfoIndicador"
import { DetalhamentoConformidadeLegal } from "@/components/conformidade-legal/DetalhamentoConformidadeLegal"

export const metadata: Metadata = { title: "Detalhamento de conformidade legal" }
export const dynamic = "force-dynamic"
export default async function DetalhamentoPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await assertTelaVisivel("conformidade-legal")
  let dados: DadosConformidadeLegal | null = null
  try { dados = await getConformidadeLegal(await escopoConformidadeAtual()) } catch { console.error("Falha ao consultar o detalhamento de conformidade legal.") }
  return <div className="conformidade-legal min-w-0 space-y-6">
    <header>
      <span className="eyebrow"><TableProperties className="h-3.5 w-3.5" /> Conformidade legal</span>
      <div className="mt-3 flex items-center gap-3">
        <h1 className="font-display text-3xl font-semibold text-foreground">Detalhamento</h1>
        <InfoIndicador titulo="Detalhamento de conformidade legal">
          <p>Os agrupamentos e os registros respeitam os filtros recebidos do dashboard. Quem tem acesso ao indicador pode consultar todos os CRs.</p>
          <ul className="list-disc space-y-2 pl-5">
            <li><b>Registros:</b> uma linha por pessoa, período e hierarquia. A mesma pessoa pode aparecer em várias linhas.</li>
            <li><b>Ocorrências:</b> soma das ocorrências do recorte. Quando há um tipo selecionado, entra apenas esse tipo.</li>
            <li><b>Pessoas distintas:</b> cada pessoa identificada conta uma vez por célula e uma vez no total. O total pode ser menor que a soma dos grupos. Pessoas sem identificação ficam fora desta contagem.</li>
            <li><b>Drill:</b> defina a sequência dos níveis e expanda as linhas para consultar os níveis seguintes até os registros individuais. A busca restringe os registros considerados.</li>
            <li>Totais e subtotais da origem não são registros. Períodos podem estar incompletos; não há percentual de conformidade sobre o quadro total.</li>
          </ul>
        </InfoIndicador>
      </div>
    </header>
    {dados ? <DetalhamentoConformidadeLegal dados={dados} filtros={lerFiltrosConformidade(searchParams)} /> : <div role="alert" className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6 text-destructive">Não foi possível carregar o detalhamento. Atualize a página para tentar novamente.</div>}
  </div>
}


