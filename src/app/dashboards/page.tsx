import type { Metadata } from "next"
import { Sparkles } from "lucide-react"

export const metadata: Metadata = { title: "In-Haus Hub" }

/** Página inicial comum a todas as pessoas autenticadas, sem depender de permissões de tela. */
export default function DashboardsHome() {
  return (
    <div className="w-full">
      <section className="reveal max-w-3xl" aria-labelledby="welcome-title">
        <span className="eyebrow">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          In-Haus Hub
        </span>
        <h1
          id="welcome-title"
          className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          Bem-vindo!
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Que bom ter você por aqui. Seu ambiente de trabalho está pronto.
        </p>
      </section>
    </div>
  )
}
