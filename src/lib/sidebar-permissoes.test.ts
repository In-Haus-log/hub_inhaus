import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, describe, expect, it, vi } from "vitest"
vi.stubGlobal("React", React)
afterAll(() => vi.unstubAllGlobals())
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboards/clientes/bi/42/10" }))
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...props }, children) }))
vi.mock("@/components/brand/InhausLogo", () => ({ InhausLogo: () => null }))
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"

describe("navegação do cliente com indicadores concedidos", () => {
  const cliente = { id: 42, nome: "Cliente autorizado", slug: "cliente-autorizado", relatorios: [{ id: 10, titulo: "Operação", icone: "factory" }] }
  it("exibe o BI e o indicador interno explicitamente concedidos", () => {
    const html = renderToStaticMarkup(React.createElement(DashboardSidebar, { classificacao: "CLIENTE", visibleScreens: ["cliente-bi:42", "conformidade-legal"], clientesBi: [cliente] }))
    expect(html).toContain('href="/dashboards/clientes/bi/42/10"')
    expect(html).toContain('href="/dashboards/conformidade-legal"')
    expect(html).not.toContain('href="/dashboards/usuarios"')
    expect(html).not.toContain('href="/dashboards/administracao/clientes"')
    expect(html).not.toContain('href="/dashboards/clientes/atlas/desvios"')
  })
  it("não inclui indicadores internos não concedidos", () => {
    const html = renderToStaticMarkup(React.createElement(DashboardSidebar, { classificacao: "CLIENTE", visibleScreens: ["cliente-bi:42"], clientesBi: [cliente] }))
    expect(html).toContain('href="/dashboards"')
    expect(html).toContain("Início")
    expect(html).not.toContain('href="/dashboards/conformidade-legal"')
    expect(html).toContain('href="/dashboards/clientes/bi/42/10"')
  })
  it("habilita gestão de BI somente com o papel Analista, sem conceder Usuários", () => {
    const html = renderToStaticMarkup(React.createElement(DashboardSidebar, { classificacao: "CLIENTE", isAnalista: true, visibleScreens: ["cliente-bi:42"], clientesBi: [cliente] }))
    expect(html).toContain('href="/dashboards/administracao/relatorios"')
    expect(html).not.toContain('href="/dashboards/usuarios"')
  })
})
