"use client"

import * as React from "react"
import {
  UserPlus,
  Search,
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { SeletorTelas } from "@/components/admin/SeletorTelas"
import { SeletorCrs } from "@/components/admin/SeletorCrs"
import { ToastProvider, useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

type UsuarioAdmin = {
  authUserId: string | null
  name: string | null
  email: string
  cpf: string | null
  type: string | null
  isActive: boolean
  hasAccess: boolean
  isAdmin: boolean
  visibleScreens: string[]
  ehSeguranca: boolean
  classificacao: string
  clientes: string[]
  crs: string[]
  contratantes: number[]
}

type Props = {
  meuEmail: string | null
  globalConfigurado: boolean
}

const POR_PAGINA = 15

export function UsuariosAdmin(props: Props) {
  return (
    <ToastProvider>
      <Conteudo {...props} />
    </ToastProvider>
  )
}

function Conteudo({ meuEmail }: Props) {
  const { sucesso, erro } = useToast()

  const [usuarios, setUsuarios] = React.useState<UsuarioAdmin[]>([])
  const [carregando, setCarregando] = React.useState(true)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [busca, setBusca] = React.useState("")
  const [pagina, setPagina] = React.useState(1)
  const [criando, setCriando] = React.useState(false)
  const [editando, setEditando] = React.useState<string | null>(null)

  const carregar = React.useCallback(async () => {
    setCarregando(true)
    try {
      const r = await fetch("/api/admin/usuarios", { cache: "no-store" })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? "Falha ao carregar")
      setUsuarios(d.usuarios ?? [])
      setAviso(d.configurado ? null : d.aviso ?? null)
    } catch (e) {
      erro("Não foi possível carregar os usuários", (e as Error).message)
    } finally {
      setCarregando(false)
    }
  }, [erro])

  React.useEffect(() => {
    carregar()
  }, [carregar])

  const filtrados = React.useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return usuarios
    return usuarios.filter((u) =>
      [u.name ?? "", u.email, u.cpf ?? ""].some((c) => c.toLowerCase().includes(t)),
    )
  }, [usuarios, busca])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  React.useEffect(() => {
    setPagina(1)
  }, [busca])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Administração
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-navy">
            Usuários
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre pessoas, conceda acesso ao hub e escolha quais painéis cada uma pode ver.
          </p>
        </div>
        <Button type="button" variant="gradient" onClick={() => setCriando((v) => !v)}>
          <UserPlus className="h-4 w-4" /> Novo usuário
        </Button>
      </header>

      {aviso && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {criando && (
        <FormularioCriar
          onCancelar={() => setCriando(false)}
          onCriado={() => {
            setCriando(false)
            carregar()
          }}
        />
      )}

      <div className="glass rounded-3xl p-4 sm:p-6">
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail ou CPF…"
            className="pl-8"
          />
        </div>

        {carregando ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando usuários…
          </p>
        ) : filtrados.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {usuarios.length === 0 ? "Nenhum usuário para exibir." : "Nenhum resultado para a busca."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Nome</th>
                    <th className="px-3 py-2 font-semibold">E-mail</th>
                    <th className="px-3 py-2 font-semibold">CPF</th>
                    <th className="px-3 py-2 font-semibold">Acesso</th>
                    <th className="px-3 py-2 font-semibold">Admin</th>
                    <th className="px-3 py-2 font-semibold">Segurança</th>
                    <th className="px-3 py-2 font-semibold">Telas</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((u) => (
                    <React.Fragment key={u.email}>
                      <tr className="border-b border-navy/5">
                        <td className="px-3 py-2.5 font-medium text-navy">
                          {u.name ?? "—"}
                          {!u.isActive && (
                            <span className="ml-2 rounded-full bg-navy/10 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              inativo
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{u.email}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{u.cpf ?? "—"}</td>
                        <td className="px-3 py-2.5"><Selo on={u.hasAccess} rotuloOn="Com acesso" rotuloOff="Sem acesso" /></td>
                        <td className="px-3 py-2.5"><Selo on={u.isAdmin} rotuloOn="Admin" rotuloOff="—" /></td>
                        <td className="px-3 py-2.5"><Selo on={u.ehSeguranca} rotuloOn="Segurança" rotuloOff="—" /></td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {u.isAdmin || u.ehSeguranca ? "todas" : u.visibleScreens.length}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditando(editando === u.email ? null : u.email)}
                          >
                            {editando === u.email ? "Fechar" : "Gerenciar"}
                          </Button>
                        </td>
                      </tr>
                      {editando === u.email && (
                        <tr>
                          <td colSpan={8} className="px-3 pb-4">
                            <EditorAcesso
                              usuario={u}
                              ehEuMesmo={!!meuEmail && meuEmail.toLowerCase() === u.email.toLowerCase()}
                              onSalvo={() => {
                                setEditando(null)
                                carregar()
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{filtrados.length} usuário(s)</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" disabled={paginaAtual <= 1} onClick={() => setPagina((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <span className="text-xs">Página {paginaAtual} de {totalPaginas}</span>
                <Button type="button" variant="ghost" size="sm" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                  Próxima <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Selo({ on, rotuloOn, rotuloOff }: { on: boolean; rotuloOn: string; rotuloOff: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        on ? "bg-emerald-500/12 text-emerald-700" : "bg-navy/8 text-muted-foreground",
      )}
    >
      {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {on ? rotuloOn : rotuloOff}
    </span>
  )
}

function FormularioCriar({
  onCancelar,
  onCriado,
}: {
  onCancelar: () => void
  onCriado: () => void
}) {
  const { sucesso, erro } = useToast()
  const [nome, setNome] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [cpf, setCpf] = React.useState("")
  const [senha, setSenha] = React.useState("")
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [seguranca, setSeguranca] = React.useState(false)
  const [telas, setTelas] = React.useState<string[]>([])
  const [crs, setCrs] = React.useState<string[]>([])
  const [ehCliente, setEhCliente] = React.useState(false)
  const [ocupado, setOcupado] = React.useState(false)

  const classificacao: "INTERNO" | "CLIENTE" = ehCliente ? "CLIENTE" : "INTERNO"
  const podeSalvar =
    nome.trim() && email.trim() && cpf.replace(/\D/g, "").length === 11 && senha.length >= 8

  React.useEffect(() => {
    if (ehCliente && isAdmin) setIsAdmin(false)
  }, [ehCliente, isAdmin])

  async function salvar() {
    setOcupado(true)
    try {
      const r = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nome,
          email,
          cpf,
          password: senha,
          isAdmin,
          seguranca,
          hasAccess: true,
          visibleScreens: telas,
          classificacao,
          crs,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? "Falha ao cadastrar")
      sucesso("Usuário cadastrado", `${d.usuario?.name ?? email} agora tem acesso ao hub.`)
      onCriado()
    } catch (e) {
      erro("Não foi possível cadastrar", (e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="glass rounded-3xl p-6">
      <h2 className="font-display text-lg font-semibold text-navy">Cadastrar usuário</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Nome, e-mail, CPF e senha são obrigatórios (a identidade é criada no provedor central).
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Maria Silva" />
        </Campo>
        <Campo rotulo="E-mail">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@empresa.com" type="email" />
        </Campo>
        <Campo rotulo="CPF">
          <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Somente números" maxLength={14} />
        </Campo>
        <Campo rotulo="Senha inicial">
          <Input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" type="password" />
        </Campo>
        <Campo rotulo="Telas visíveis">
          <SeletorTelas value={telas} onChange={setTelas} />
          <p className="mt-1.5 text-xs text-muted-foreground">Administradores veem todas as telas.</p>
        </Campo>
        <div className="mt-3 max-w-sm">
          <label className="mb-1.5 block text-sm font-medium text-navy">CRs que pode ver (dados)</label>
          <SeletorCrs value={crs} onChange={setCrs} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {isAdmin && !ehCliente
              ? "Como administrador interno, este usuário vê os dados de todos os CRs."
              : "Gerentes: vincule os CRs da carteira. Sem CR vinculado, os indicadores por CR ficam vazios."}{" "}
            Esses CRs valem para TODOS os indicadores recortados por CR (ex.: RE x OR, Controle
            de Quadro), não só para um indicador específico.
          </p>
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-navy">
            <Checkbox checked={ehCliente} onCheckedChange={(v) => setEhCliente(!!v)} />
            É cliente?
          </label>
          <label
            className={cn("flex items-center gap-2 text-sm text-navy", ehCliente && "opacity-50")}
            title={ehCliente ? "Usuário CLIENTE não pode ser administrador" : undefined}
          >
            <Checkbox
              checked={isAdmin}
              disabled={ehCliente}
              onCheckedChange={(v) => setIsAdmin(!!v)}
            />
            É administrador (vê tudo e gerencia usuários)
          </label>
          <label className="flex items-center gap-2 text-sm text-navy">
            <Checkbox checked={seguranca} onCheckedChange={(v) => setSeguranca(!!v)} />
            É Segurança (configura o EPI)
          </label>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={ocupado}>Cancelar</Button>
        <Button type="button" variant="gradient" onClick={salvar} disabled={!podeSalvar || ocupado}>
          {ocupado ? "Salvando…" : "Cadastrar"}
        </Button>
      </div>
    </div>
  )
}

function EditorAcesso({
  usuario,
  ehEuMesmo,
  onSalvo,
}: {
  usuario: UsuarioAdmin
  ehEuMesmo: boolean
  onSalvo: () => void
}) {
  const { sucesso, erro } = useToast()
  const [hasAccess, setHasAccess] = React.useState(usuario.hasAccess)
  const [isAdmin, setIsAdmin] = React.useState(usuario.isAdmin)
  const [seguranca, setSeguranca] = React.useState(usuario.ehSeguranca)
  const [telas, setTelas] = React.useState<string[]>(usuario.visibleScreens)
  const [crs, setCrs] = React.useState<string[]>(usuario.crs)
  const [ehCliente, setEhCliente] = React.useState(usuario.classificacao === "CLIENTE")
  const [ocupado, setOcupado] = React.useState(false)

  const classificacao: "INTERNO" | "CLIENTE" = ehCliente ? "CLIENTE" : "INTERNO"

  React.useEffect(() => {
    if (ehCliente && isAdmin) setIsAdmin(false)
  }, [ehCliente, isAdmin])

  async function salvar() {
    setOcupado(true)
    try {
      const r = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: usuario.email,
          authUserId: usuario.authUserId,
          name: usuario.name,
          hasAccess,
          isAdmin,
          seguranca,
          visibleScreens: telas,
          classificacao,
          crs,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? "Falha ao salvar")
      sucesso("Acesso atualizado", usuario.name ?? usuario.email)
      onSalvo()
    } catch (e) {
      erro("Não foi possível salvar", (e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="rounded-2xl border border-teal/20 bg-teal-tint/30 p-4">
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-navy">
          <Checkbox checked={hasAccess} disabled={ehEuMesmo} onCheckedChange={(v) => setHasAccess(!!v)} />
          Tem acesso ao hub
        </label>
        <label
          className={cn("flex items-center gap-2 text-sm text-navy", ehCliente && "opacity-50")}
          title={ehCliente ? "Usuário CLIENTE não pode ser administrador" : undefined}
        >
          <Checkbox
            checked={isAdmin}
            disabled={ehEuMesmo || ehCliente}
            onCheckedChange={(v) => setIsAdmin(!!v)}
          />
          Administrador
        </label>
        <label
          className={cn("flex items-center gap-2 text-sm text-navy", !usuario.authUserId && "opacity-50")}
          title={!usuario.authUserId ? "Usuário sem identidade no provedor central" : undefined}
        >
          <Checkbox
            checked={seguranca}
            disabled={!usuario.authUserId}
            onCheckedChange={(v) => setSeguranca(!!v)}
          />
          Segurança (configura o EPI)
        </label>
        <label className="flex items-center gap-2 text-sm text-navy">
          <Checkbox checked={ehCliente} onCheckedChange={(v) => setEhCliente(!!v)} />
          É cliente?
        </label>
        {ehEuMesmo && (
          <span className="text-xs text-muted-foreground">Você não pode revogar o próprio acesso/admin.</span>
        )}
      </div>
      <div className="mt-3 max-w-sm">
        <label className="mb-1.5 block text-sm font-medium text-navy">Telas visíveis</label>
        <SeletorTelas value={telas} onChange={setTelas} />
        {isAdmin && (
          <p className="mt-1.5 text-xs text-muted-foreground">Como administrador, este usuário vê todas as telas.</p>
        )}
      </div>
      <div className="mt-3 max-w-sm">
        <label className="mb-1.5 block text-sm font-medium text-navy">CRs que pode ver (dados)</label>
        <SeletorCrs value={crs} onChange={setCrs} />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {isAdmin && !ehCliente
            ? "Como administrador interno, este usuário vê os dados de todos os CRs."
            : "Gerentes: vincule os CRs da carteira. Sem CR vinculado, os indicadores por CR ficam vazios."}{" "}
          Esses CRs valem para TODOS os indicadores recortados por CR (ex.: RE x OR, Controle de
          Quadro), não só para um indicador específico.
        </p>
      </div>
      <div className="mt-4 flex items-center justify-end">
        <Button type="button" variant="gradient" size="sm" onClick={salvar} disabled={ocupado}>
          {ocupado ? "Salvando…" : "Salvar acesso"}
        </Button>
      </div>
    </div>
  )
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-navy">{rotulo}</label>
      {children}
    </div>
  )
}
