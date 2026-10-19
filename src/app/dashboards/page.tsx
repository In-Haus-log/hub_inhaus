import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowUpRight, Sparkles } from "lucide-react"

import { TiltCard } from "@/components/TiltCard"
import { DOMINIOS_NAVEGACAO as DOMINIOS, telasVisiveis } from "@/lib/domains"
import { resolverPapeisDashboard } from "@/lib/dashboard-acesso"

export const metadata: Metadata = { title: "Visão geral" }
export const dynamic = "force-dynamic"

/** Valor de destaque fictício por domínio — nenhum dado real é consultado aqui. */
const VALOR_PLACEHOLDER: Record<string, { valor: string; legenda: string }> = {
  seguranca: { valor: "—", legenda: "sem ocorrências registradas ainda" },
  rh: { valor: "—", legenda: "quadro e movimentação em breve" },
  qualidade: { valor: "—", legenda: "não conformidades em breve" },
  treinamentos: { valor: "—", legenda: "matriz e horas em breve" },
  financeiro: { valor: "—", legenda: "custo de pessoal em breve" },
}

export default async function DashboardsHome() {
  // Líder puro (só preenche) cai direto na lista de checklists — a visão geral
  // com KPIs é para admin/Segurança.
  const papeis = await resolverPapeisDashboard()
  if (papeis.soPreenche) redirect("/dashboards/checklists")

  // "Visão Geral" é permissão concedida como as demais: quem não a tem (admin sempre
  // tem) não vê a Home do hub — vai direto para a 1ª tela liberada. Cobre tanto o
  // CLIENTE quanto o INTERNO que só recebeu telas de cliente. Sem nenhuma tela, mostra
  // um aviso enxuto.
  const temHome = papeis.isAdmin || papeis.visibleScreens.includes("home")
  if (!temHome && papeis.clientesBi?.[0]) redirect(`/dashboards/clientes/bi/${papeis.clientesBi[0].id}`)
  if (!temHome && papeis.isAnalista) redirect("/dashboards/administracao/clientes")
  if (!temHome) {
    const visiveis = telasVisiveis({
      isAdmin: papeis.isAdmin,
      visibleScreens: papeis.visibleScreens,
    }).filter((t) => t.key !== "home")
    if (visiveis[0]) redirect(visiveis[0].href)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-navy">Acesso em configuração</h1>
        <p className="mt-2 text-muted-foreground">
          Você ainda não tem telas liberadas. Fale com o administrador para liberar o seu acesso.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Cabeçalho */}
      <section className="reveal flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">
            <Sparkles className="h-3.5 w-3.5" />
            Painel da operação
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Bem-vindo ao In-Haus Hub
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Este é o ambiente onde os indicadores de Segurança, RH, Qualidade,
            Treinamentos e Financeiro vão viver. A estrutura está pronta — os
            números entram em breve.
          </p>
        </div>
      </section>

      {/* Domínios do hub */}
      <section className="space-y-4">
        <div className="reveal">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Domínios
          </h2>
          <p className="text-sm text-muted-foreground">
            Acesse a visão geral de cada área da operação.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {DOMINIOS.map((dominio, index) => {
            const Icone = dominio.icone
            const placeholder = VALOR_PLACEHOLDER[dominio.key] ?? {
              valor: "—",
              legenda: "indicadores em breve",
            }
            const href = dominio.telas[0]?.href ?? `/dashboards/${dominio.key}`

            return (
              <TiltCard key={dominio.key} max={5}>
                <Link href={href} className="block h-full">
                  <div
                    className={`glass reveal delay-${Math.min(index + 1, 5)} relative h-full overflow-hidden rounded-3xl p-6 transition-shadow hover:shadow-glow`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-tint text-teal">
                        <Icone className="h-5 w-5" />
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="mt-5 text-sm font-medium text-foreground">{dominio.label}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-display text-2xl font-semibold text-foreground">
                        {placeholder.valor}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{placeholder.legenda}</p>
                  </div>
                </Link>
              </TiltCard>
            )
          })}
        </div>
      </section>
    </div>
  )
}

