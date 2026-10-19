"use client"

import { useState } from "react"
import { Loader2, Lock, Mail, ShieldCheck, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Step = "credentials" | "twoFactor"

export function LoginForm() {
  const [step, setStep] = useState<Step>("credentials")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [tempToken, setTempToken] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível entrar.")
        return
      }
      if (data?.requiresTwoFactor) {
        setTempToken(data.tempToken)
        setStep("twoFactor")
        return
      }
      window.location.replace("/dashboards")
    } catch {
      setError("Falha de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  async function handleTwoFactor(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, totpCode: code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? "Código inválido.")
        return
      }
      window.location.replace("/dashboards")
    } catch {
      setError("Falha de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {step === "credentials" ? (
        <form onSubmit={handleCredentials} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/70">
              E-mail corporativo
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@inhaus.com.br"
                className="border-white/15 bg-white/[0.04] pl-10 text-white shadow-none placeholder:text-white/35 focus-visible:border-teal-soft/70 focus-visible:ring-teal/30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/70">
              Senha
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-white/15 bg-white/[0.04] pl-10 text-white shadow-none placeholder:text-white/35 focus-visible:border-teal-soft/70 focus-visible:ring-teal/30"
              />
            </div>
          </div>

          <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {loading ? "Entrando…" : "Entrar no hub"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleTwoFactor} className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-teal/25 bg-teal/10 px-4 py-3 text-sm text-teal-soft">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            Verificação em duas etapas ativada. Informe o código do seu autenticador.
          </div>
          <div className="space-y-2">
            <Label htmlFor="code" className="text-white/70">
              Código de verificação
            </Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="border-white/15 bg-white/[0.04] text-center text-lg tracking-[0.5em] text-white shadow-none placeholder:text-white/30 focus-visible:border-teal-soft/70 focus-visible:ring-teal/30"
            />
          </div>
          <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {loading ? "Verificando…" : "Verificar e entrar"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStep("credentials")
              setCode("")
              setError(null)
            }}
            className="w-full text-center text-sm text-white/55 transition-colors hover:text-teal-soft"
          >
            Voltar
          </button>
        </form>
      )}
    </div>
  )
}
