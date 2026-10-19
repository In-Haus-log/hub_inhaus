import { NextResponse } from "next/server"
import { z } from "zod"

import { guardAdmin } from "@/lib/admin-guard"
import { invalidarAutorizacaoLocal } from "@/lib/auth-session"
import { GlobalAuthError, normalizeEmail } from "@/lib/global-auth"
import {
  listarUsuariosAdmin,
  criarUsuarioAdmin,
  atualizarAcessoLocal,
  AtribuicaoContratanteInvalida,
} from "@/lib/usuarios-admin"

export const dynamic = "force-dynamic"

const globalConfigurado = () => Boolean(process.env.AUTH_BASE_URL)

const primeiroErro = (e: z.ZodError) => e.issues[0]?.message ?? "Dados inválidos"

// CPF: aceita com máscara, normaliza para 11 dígitos.
const cpfSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 11, "CPF deve ter 11 dígitos")

const telasSchema = z.array(z.string()).default([])

const criarSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  email: z.string().trim().email("E-mail inválido"),
  cpf: cpfSchema,
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  isAdmin: z.boolean().default(false),
  isAnalista: z.boolean().default(false),
  hasAccess: z.boolean().default(true),
  visibleScreens: telasSchema,
  seguranca: z.boolean().default(false),
  classificacao: z.enum(["INTERNO", "CLIENTE"]).default("INTERNO"),
  clientes: z.array(z.string().trim().min(1)).optional(),
  crs: z.array(z.string().trim().min(1)).optional(),
  contratantes: z.array(z.number().int()).optional(),
})

const acessoSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  authUserId: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  hasAccess: z.boolean(),
  isAdmin: z.boolean(),
  isAnalista: z.boolean().optional(),
  visibleScreens: telasSchema,
  seguranca: z.boolean().optional(),
  classificacao: z.enum(["INTERNO", "CLIENTE"]).default("INTERNO"),
  clientes: z.array(z.string().trim().min(1)).optional(),
  crs: z.array(z.string().trim().min(1)).optional(),
  contratantes: z.array(z.number().int()).optional(),
})

function mapaErro(e: unknown): NextResponse {
  if (e instanceof AtribuicaoContratanteInvalida) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
  if (e instanceof GlobalAuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status || 502 })
  }
  const msg = e instanceof Error ? e.message : "Falha ao processar"
  return NextResponse.json({ error: msg }, { status: 500 })
}

// GET — lista usuários (identidade global + acesso local). Degrada com aviso quando
// o global_auth não está configurado ou não há Bearer (acesso livre de dev).
export async function GET() {
  const g = await guardAdmin()
  if (!g.ok) return g.response

  if (!globalConfigurado()) {
    return NextResponse.json({
      configurado: false,
      usuarios: [],
      aviso:
        "global_auth não configurado: defina AUTH_BASE_URL e AUTH_API_KEY no ambiente para listar e cadastrar usuários.",
    })
  }
  if (!g.ctx.accessToken) {
    return NextResponse.json({
      configurado: false,
      usuarios: [],
      aviso:
        "A listagem usa o login do administrador. No acesso livre de desenvolvimento não há login — desligue o HUB_ACESSO_LIVRE e entre como administrador para listar e cadastrar usuários.",
    })
  }

  try {
    const usuarios = await listarUsuariosAdmin(g.ctx.accessToken)
    return NextResponse.json({ configurado: true, usuarios })
  } catch (e) {
    const aviso = e instanceof GlobalAuthError ? e.message : "Falha ao listar usuários"
    return NextResponse.json({ configurado: false, usuarios: [], aviso })
  }
}

// POST — cria a identidade no global_auth (ou reusa) e concede o acesso local.
export async function POST(request: Request) {
  const g = await guardAdmin()
  if (!g.ok) return g.response

  if (!globalConfigurado()) {
    return NextResponse.json(
      { error: "global_auth não configurado (AUTH_BASE_URL/AUTH_API_KEY ausentes)." },
      { status: 503 },
    )
  }

  let corpo: unknown
  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }
  const parsed = criarSchema.safeParse(corpo)
  if (!parsed.success) {
    return NextResponse.json({ error: primeiroErro(parsed.error) }, { status: 400 })
  }

  if (parsed.data.classificacao === "CLIENTE" && parsed.data.isAdmin) {
    return NextResponse.json({ error: "Usuário CLIENTE não pode ser administrador." }, { status: 400 })
  }

  try {
    const usuario = await criarUsuarioAdmin(parsed.data)
    invalidarAutorizacaoLocal(parsed.data.email)
    return NextResponse.json({ usuario })
  } catch (e) {
    return mapaErro(e)
  }
}

// PATCH — atualiza SÓ o acesso local (autorização). Trava anti-lockout: o admin não
// pode revogar o próprio acesso nem remover o próprio admin.
export async function PATCH(request: Request) {
  const g = await guardAdmin()
  if (!g.ok) return g.response

  let corpo: unknown
  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }
  const parsed = acessoSchema.safeParse(corpo)
  if (!parsed.success) {
    return NextResponse.json({ error: primeiroErro(parsed.error) }, { status: 400 })
  }

  if (parsed.data.classificacao === "CLIENTE" && parsed.data.isAdmin) {
    return NextResponse.json({ error: "Usuário CLIENTE não pode ser administrador." }, { status: 400 })
  }

  const alvoEhEuMesmo =
    g.ctx.email && normalizeEmail(parsed.data.email) === normalizeEmail(g.ctx.email)
  if (alvoEhEuMesmo && (!parsed.data.hasAccess || !parsed.data.isAdmin)) {
    return NextResponse.json(
      { error: "Você não pode revogar o próprio acesso nem remover o próprio administrador." },
      { status: 400 },
    )
  }

  try {
    const usuario = await atualizarAcessoLocal(parsed.data)
    invalidarAutorizacaoLocal(parsed.data.email)
    return NextResponse.json({ usuario })
  } catch (e) {
    return mapaErro(e)
  }
}
