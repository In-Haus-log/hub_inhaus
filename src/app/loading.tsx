import { InhausLogo } from "@/components/brand/InhausLogo"

export default function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div role="status" className="space-y-5 text-center">
        <InhausLogo className="mx-auto h-9" />
        <p className="text-sm text-muted-foreground">Preparando seu ambiente…</p>
      </div>
    </main>
  )
}
