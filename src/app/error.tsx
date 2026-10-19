"use client"

import { Button } from "@/components/ui/button"

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div role="alert" className="max-w-md space-y-4 text-center">
        <h1 className="font-display text-2xl font-semibold text-navy">Não foi possível abrir seu ambiente</h1>
        <p className="text-sm text-muted-foreground">Tente carregar a página novamente.</p>
        <Button onClick={reset} variant="gradient">Tentar novamente</Button>
      </div>
    </main>
  )
}
