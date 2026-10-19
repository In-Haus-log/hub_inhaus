import { Activity, RefreshCw } from "lucide-react"
import { assertTelaVisivel } from "@/lib/dashboard-acesso"
import { acessoLivreLiberado } from "@/lib/dev-auth"
import { getSessionReadOnly } from "@/lib/auth-session"
import { resolverEscopoDados, type EscopoDados } from "@/lib/seguranca/escopo-dados"
import { getDashboardAbsenteismoGps, getOpcoesAbsenteismoGps, type DashboardGps, type FiltrosGps, type OpcoesGps } from "@/lib/absenteismo-gps"
import { InfoIndicador } from "@/components/dashboard/InfoIndicador"
import { PainelAbsenteismo } from "./PainelAbsenteismo"

type SearchParams = Record<string, string | string[] | undefined>
const valor = (v: string | string[] | undefined) => typeof v === "string" ? v : ""

async function escopoAtual(): Promise<EscopoDados> {
  if (acessoLivreLiberado()) return { tipo: "todos" }
  const resultado = await getSessionReadOnly()
  if (resultado.status !== "ok") return { tipo: "lista", crs: [] }
  return resolverEscopoDados({ authUserId: resultado.sessao.user.id, isAdmin: resultado.sessao.authorization.isAdmin, classificacao: resultado.sessao.authorization.classificacao })
}

export default async function PaginaAbsenteismo({ searchParams }: { searchParams: SearchParams }) {
  await assertTelaVisivel("absenteismo")
  const escopo = await escopoAtual()
  let opcoes: OpcoesGps = { meses: [], gerentes: [], crs: [] }
  let dados: DashboardGps | null = null
  let filtros: FiltrosGps = { mes: "" }
  let erro = false
  try {
    opcoes = await getOpcoesAbsenteismoGps(escopo)
    const mes = valor(searchParams.mes)
    filtros = {
      mes: opcoes.meses.includes(mes) ? mes : opcoes.meses[0] ?? "",
      gerente: valor(searchParams.gerente) || valor(searchParams.ger) || undefined,
      cr: valor(searchParams.cr) || undefined,
    }
    if (filtros.mes) dados = await getDashboardAbsenteismoGps(filtros, escopo)
  } catch (error) {
    console.error("Falha ao consultar absenteísmo GPS:", error instanceof Error ? error.message : "erro desconhecido")
    erro = true
  }
  const atualizado = dados?.atualizadoEm && !Number.isNaN(Date.parse(dados.atualizadoEm))
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(dados.atualizadoEm)) : null
  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-medium text-teal"><Activity className="h-3.5 w-3.5" aria-hidden="true" /> Recursos Humanos</p>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-navy sm:text-3xl">Absenteísmo</h1>
          <InfoIndicador titulo="Como ler o absenteísmo">
            <p>Os percentuais representam o <strong>impacto financeiro das ausências sobre as verbas salariais</strong> do período, conforme o acompanhamento do GPS.</p>
            <ul className="list-disc space-y-2 pl-4">
              <li><strong>Injustificado:</strong> ausências descontadas, menos devoluções, divididas pelas verbas salariais.</li>
              <li><strong>Justificado:</strong> ausências abonadas divididas pelas verbas salariais.</li>
              <li><strong>Geral:</strong> total de ausências, já descontadas as devoluções, dividido pelas verbas salariais.</li>
              <li>Os valores do recorte são somados antes da divisão. <strong>Não fazemos média dos percentuais individuais</strong>, nem somamos linhas de total e subtotal.</li>
              <li>A comparação usa o <strong>mês calendário imediatamente anterior</strong>, com o mesmo gerente e CR. A diferença aparece em pontos percentuais (p.p.). Se faltar esse mês, não há comparação.</li>
              <li>O histórico apresenta os últimos 12 meses até o período escolhido. Meses sem dados ficam sem barra. Sem base salarial, o percentual aparece como traço.</li>
              <li>O detalhamento considera cada vínculo de colaborador, gerente e CR no mês. Uma pessoa com mais de um vínculo pode aparecer em mais de uma linha, mas é contada uma vez no total de pessoas.</li>
              <li>Cada pessoa vê apenas os centros de resultado aos quais possui acesso. O mês mais recente disponível é selecionado inicialmente.</li>
            </ul>
            <p><strong>Exemplo:</strong> R$ 2.000 em ausências e R$ 100.000 em verbas salariais representam <strong>2%</strong>. Passar de 3% para 2% corresponde a uma queda de <strong>1 p.p.</strong></p>
          </InfoIndicador>
        </div>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">Uma visão da presença na operação e do impacto das ausências.</p>
      </div>
      {atualizado && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Atualizado em {atualizado}</p>}
    </header>
    {erro ? <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive"><p className="font-semibold">Não foi possível carregar os indicadores.</p><p className="mt-1">Tente novamente em instantes.</p></div>
      : dados ? <PainelAbsenteismo dados={dados} opcoes={opcoes} filtros={filtros} />
        : <section className="rounded-2xl border border-navy/10 bg-white p-8 text-sm text-muted-foreground"><h2 className="mb-2 text-base font-semibold text-navy">Ainda não há dados neste recorte</h2><p>As competências disponíveis aparecerão após a próxima atualização para os centros de resultado aos quais você tem acesso.</p></section>}
  </div>
}
