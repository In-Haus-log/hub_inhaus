"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Menu, X, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { InhausLogo } from "@/components/brand/InhausLogo"
import type { ClienteBi } from "@/lib/powerbi-permissoes"

type DashboardShellProps = {
  children: ReactNode
  /** Sessão já resolvida no layout server — nada de buscar /api/auth/session aqui,
   *  senão o acesso livre de dev (USUARIO_DEV) não teria como preencher a topbar. */
  nome: string | null
  email: string | null
  isAdmin: boolean
  isAnalista?: boolean
  clientesBi?: ClienteBi[]
  /** Pode configurar EPI (admin/Segurança) — mostra Configurar/Checklists/Líderes. */
  epiConfig?: boolean
  /** Pode validar EPI (admin/Segurança/líder) — mostra Validações. */
  epiValida?: boolean
  /** Mantido por compatibilidade com o perfil resolvido no layout. */
  soPreenche?: boolean
  /** Telas concedidas ao usuário (null = todas, ex.: admin/dev) — filtra os grupos de domínio da sidebar. */
  visibleScreens?: string[] | null
  /** "INTERNO" | "CLIENTE" — CLIENTE troca a sidebar para o modo portal (só telas do cliente + logo). */
  classificacao?: string
}

export function DashboardShell({ children, nome, email, isAdmin, isAnalista = false, clientesBi = [], epiConfig = false, epiValida = false, visibleScreens = null, classificacao = "INTERNO" }: DashboardShellProps) {
  const router = useRouter()
  const [drawer, setDrawer] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // trava o scroll do body quando o drawer mobile está aberto
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [drawer])

  const handleLogout = async () => {
    setSigningOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      /* logout local não depende do servidor */
    }
    router.push("/login")
  }

  return (
    <div className="min-h-dvh bg-inhaus-radial">
      {/* Sidebar fixa (desktop) — vidro claro sobre o canvas, como no Amyris. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-navy/10 bg-white/80 backdrop-blur-xl lg:block">
        <DashboardSidebar
          isAdmin={isAdmin}
          isAnalista={isAnalista}
          clientesBi={clientesBi}
          epiConfig={epiConfig}
          epiValida={epiValida}
          nome={nome}
          email={email}
          onLogout={handleLogout}
          signingOut={signingOut}
          visibleScreens={visibleScreens}
          classificacao={classificacao}
        />
      </aside>

      {/* Drawer mobile mantém a navegação disponível para todos os perfis. */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          drawer ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-navy-ink/40 backdrop-blur-sm transition-opacity duration-300",
            drawer ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setDrawer(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-72 border-r border-navy/10 bg-white shadow-soft transition-transform duration-300",
            drawer ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <DashboardSidebar
            isAdmin={isAdmin}
            isAnalista={isAnalista}
            clientesBi={clientesBi}
            epiConfig={epiConfig}
            epiValida={epiValida}
            nome={nome}
            email={email}
            onLogout={handleLogout}
            signingOut={signingOut}
            onNavigate={() => setDrawer(false)}
            visibleScreens={visibleScreens}
            classificacao={classificacao}
          />
        </div>
      </div>

      {/* Conteúdo */}
      <div className="lg:pl-72">
        {/* Topbar — vidro claro, contínua com o canvas. */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-navy/10 bg-white/70 px-4 backdrop-blur-xl sm:px-6">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-navy hover:bg-teal-tint lg:hidden"
            onClick={() => setDrawer((v) => !v)}
            aria-label={drawer ? "Fechar menu" : "Abrir menu"}
          >
            {drawer ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Buscar indicadores, guias…"
              className="h-10 w-full rounded-xl border border-input bg-white/70 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-teal/40 focus:ring-2 focus:ring-teal/20"
            />
          </div>

          <InhausLogo className="ml-auto hidden h-6 shrink-0 sm:inline-block" />
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  )
}
