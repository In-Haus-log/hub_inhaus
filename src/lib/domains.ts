import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarX,
  ClipboardCheck,
  Clock,
  FileWarning,
  GraduationCap,
  Grid3x3,
  HardHat,
  LayoutDashboard,
  ListChecks,
  ListPlus,
  ClipboardList,
  Repeat,
  ShieldCheck,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  CalendarCheck,
  Sheet,
  type LucideIcon,
} from "lucide-react"

/**
 * FONTE DE VERDADE ÚNICA dos domínios e telas do hub.
 *
 * Alimenta AO MESMO TEMPO: a sidebar, a command palette, a Home e o controle de
 * permissões. Adicionar ou alterar um indicador significa editar ESTE arquivo —
 * nunca duplicar a lista em outro lugar.
 */

export type Tela = {
  /** Chave estável, salva em AuthUser.visibleScreens. Nunca renomear. */
  key: string
  label: string
  href: string
  /** Termos extras para a busca da command palette. */
  palavrasChave?: string[]
  /** Tela ainda não construída: aparece desabilitada na sidebar. */
  emBreve?: boolean
  /** Ícone exibido na sidebar antes do nome da tela. */
  icone?: LucideIcon
  /** Subdivisão dentro do domínio na sidebar (subcabeçalho agrupando por finalidade).
   *  Telas consecutivas com a mesma `divisao` ficam sob o mesmo subtítulo. */
  divisao?: string
}

/**
 * Cliente contratante dentro da área "Clientes" — agrupa as telas daquele cliente.
 * Só a área Clientes usa este nível extra (sidebar aninhada: Clientes → cliente →
 * telas). O `key` casa com o slug do contratante (ex.: "atlas").
 */
export type ClienteHub = {
  key: string
  label: string
  icone?: LucideIcon
  telas: Tela[]
}

export type Dominio = {
  key: string
  label: string
  icone: LucideIcon
  telas: Tela[]
  /** Só a área Clientes: subnível de clientes contratantes, cada um com suas telas. */
  clientes?: ClienteHub[]
}

export const DOMINIOS: Dominio[] = [
  {
    key: "conformidade-legal",
    label: "Horas Extras",
    icone: ShieldCheck,
    telas: [
      {
        key: "conformidade-legal",
        label: "Conformidade legal",
        href: "/dashboards/conformidade-legal",
        palavrasChave: ["jornada", "interjornada", "ocorrencias", "folga", "ferias", "legal"],
        icone: BarChart3,
      },
    ],
  },
  {
    key: "seguranca",
    label: "Segurança",
    icone: ShieldCheck,
    telas: [
      {
        key: "seguranca-visao-geral",
        label: "Visão geral",
        href: "/dashboards/seguranca",
        icone: LayoutDashboard,
        emBreve: true,
      },
      {
        key: "taxa-frequencia",
        label: "Taxa de frequência",
        href: "/dashboards/seguranca/taxa-frequencia",
        palavrasChave: ["acidente", "trir", "tf", "afastamento", "sst"],
        icone: Activity,
        emBreve: true,
      },
      {
        key: "quase-acidentes",
        label: "Quase acidentes",
        href: "/dashboards/seguranca/quase-acidentes",
        palavrasChave: ["incidente", "relato", "condicao insegura"],
        icone: AlertTriangle,
        emBreve: true,
      },
    ],
  },
  {
    key: "rh",
    label: "RH",
    icone: Users,
    telas: [
      {
        key: "rh-visao-geral",
        label: "Visão geral",
        href: "/dashboards/rh",
        icone: LayoutDashboard,
        emBreve: true,
      },
      {
        key: "controle-quadro",
        label: "Controle de Quadro",
        href: "/dashboards/rh/controle-quadro",
        palavrasChave: ["quadro", "colaboradores", "efetivo", "gerente regional", "headcount"],
        icone: UsersRound,
      },
      {
        key: "treinamentos-visao-geral",
        label: "Controle de Capacitação",
        href: "/dashboards/treinamentos",
        palavrasChave: ["capacitacao", "horas", "treinados", "hht", "carga horaria", "per capita", "gerencial"],
        icone: LayoutDashboard,
        divisao: "Capacitação",
      },
      {
        key: "treinamentos-registro",
        label: "Treinamentos",
        href: "/dashboards/rh/treinamentos",
        palavrasChave: ["treinamento", "presenca", "qr", "capacitacao", "nr", "lista de presenca"],
        icone: ClipboardCheck,
        divisao: "Capacitação",
      },
      {
        key: "absenteismo",
        label: "Absenteísmo",
        href: "/dashboards/rh/absenteismo",
        palavrasChave: ["falta", "presenca", "ponto", "atestado"],
        icone: CalendarX,
      },
      {
        key: "turnover",
        label: "Turnover",
        href: "/dashboards/rh/turnover",
        palavrasChave: ["desligamento", "rotatividade", "admissao"],
        icone: Repeat,
        emBreve: true,
      },
      {
        key: "headcount",
        label: "Headcount",
        href: "/dashboards/rh/headcount",
        palavrasChave: ["quadro", "efetivo", "pessoas"],
        icone: Users,
        emBreve: true,
      },
    ],
  },
  {
    key: "qualidade",
    label: "Qualidade",
    icone: BadgeCheck,
    telas: [
      {
        key: "qualidade-visao-geral",
        label: "Visão geral",
        href: "/dashboards/qualidade",
        icone: LayoutDashboard,
        emBreve: true,
      },
      {
        key: "nao-conformidades",
        label: "Não conformidades",
        href: "/dashboards/qualidade/nao-conformidades",
        palavrasChave: ["nc", "auditoria", "retrabalho", "refugo"],
        icone: FileWarning,
        emBreve: true,
      },
      {
        key: "auditorias",
        label: "Auditorias",
        href: "/dashboards/qualidade/auditorias",
        palavrasChave: ["iso", "5s", "checklist"],
        icone: ClipboardCheck,
        emBreve: true,
      },
    ],
  },
  {
    key: "treinamentos",
    label: "Treinamentos",
    icone: GraduationCap,
    telas: [
      {
        key: "matriz-competencias",
        label: "Matriz de competências",
        href: "/dashboards/treinamentos/matriz",
        palavrasChave: ["vencimento", "validade", "apto", "nr", "certificacao"],
        icone: Grid3x3,
        emBreve: true,
      },
      {
        key: "horas-treinamento",
        label: "Horas de treinamento",
        href: "/dashboards/treinamentos/horas",
        palavrasChave: ["hht", "carga horaria", "per capita"],
        icone: Clock,
        emBreve: true,
      },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    icone: Wallet,
    telas: [
      {
        key: "financeiro-visao-geral",
        label: "Visão geral",
        href: "/dashboards/financeiro",
        icone: LayoutDashboard,
        emBreve: true,
      },
      {
        key: "projecoes-analise",
        label: "Projeções",
        href: "/dashboards/financeiro/projecoes",
        palavrasChave: ["projecao", "projeção", "pec", "contrato", "rol", "mc", "margem", "parametrizacao", "parametrização"],
        icone: BarChart3,
      },
      {
        key: "flash-report",
        label: "Flash Report",
        href: "/dashboards/financeiro/flash-report",
        palavrasChave: ["flash", "projecao", "projeção", "semana", "receita", "pec", "parametrizacao"],
        icone: CalendarCheck,
      },
      {
        key: "flash-report-consolidado",
        label: "Flash Report · Consolidado",
        href: "/dashboards/financeiro/flash-report/consolidado",
        palavrasChave: ["flash", "consolidado", "envios", "pendentes", "excel", "corporativo"],
        icone: Sheet,
      },
      {
        key: "custo-pessoal",
        label: "Custo de pessoal",
        href: "/dashboards/financeiro/custo-pessoal",
        palavrasChave: ["folha", "despesa", "orcamento"],
        icone: Wallet,
        emBreve: true,
      },
    ],
  },
  {
    // Módulo EPI — as telas aparecem na lista de "Telas visíveis" (concessão) e na
    // command palette. A SIDEBAR do EPI segue por PAPEL (líder/Segurança), então este
    // domínio é OMITIDO da sidebar (ver DashboardSidebar) para não duplicar o grupo EPI.
    key: "epi",
    label: "EPI",
    icone: HardHat,
    telas: [
      {
        key: "epi-acompanhamento",
        label: "Acompanhamento",
        href: "/dashboards/epi/acompanhamento",
        palavrasChave: ["epi", "aderencia", "utilizacao"],
        icone: Activity,
      },
      {
        key: "epi-configurar",
        label: "Configurar",
        href: "/dashboards/epi/configurar",
        palavrasChave: ["epi", "assistente", "turno", "setor"],
        icone: ClipboardList,
      },
      {
        key: "epi-checklists",
        label: "Checklists",
        href: "/dashboards/epi/checklists",
        palavrasChave: ["epi", "template", "biblioteca"],
        icone: ListChecks,
      },
      {
        key: "epi-lideres",
        label: "Líderes",
        href: "/dashboards/epi/lideres",
        palavrasChave: ["epi", "responsavel", "validar"],
        icone: UserCog,
      },
      {
        key: "epi-utilizacao",
        label: "Utilização de EPIs",
        href: "/dashboards/epi/utilizacao",
        palavrasChave: ["epi", "validacao", "preenchimento"],
        icone: ClipboardCheck,
      },
    ],
  },
  {
    key: "clientes",
    label: "Clientes",
    icone: Building2,
    // A área Clientes não tem telas soltas: cada cliente contratante agrupa as suas.
    telas: [],
    clientes: [
      {
        key: "atlas",
        label: "Atlas Copco",
        icone: Building2,
        telas: [
          {
            key: "desvios-painel",
            label: "Painel de Desvios",
            href: "/dashboards/clientes/atlas/desvios/painel",
            palavrasChave: ["atlas", "indicadores", "painel", "dashboard", "desvio", "grafico"],
            icone: BarChart3,
          },
          {
            key: "desvios-acompanhamento",
            label: "Acompanhamento de Desvios",
            href: "/dashboards/clientes/atlas/desvios",
            palavrasChave: ["atlas", "ocorrencia", "desvio", "tratativa", "gps"],
            icone: FileWarning,
          },
          {
            key: "desvios-formulario",
            label: "Formulário de Desvios",
            href: "/dashboards/clientes/atlas/desvios/novo",
            palavrasChave: ["atlas", "novo desvio", "lancar ocorrencia"],
            icone: ListPlus,
          },
        ],
      },
      {
        key: "enjoei",
        label: "Enjoei",
        icone: Building2,
        telas: [
          {
            key: "enjoei-turnover",
            label: "Turnover",
            href: "/dashboards/clientes/enjoei/turnover",
            palavrasChave: ["enjoei", "rotatividade", "desligamento", "admissao", "headcount", "turnover"],
            icone: Repeat,
          },
          {
            key: "enjoei-absenteismo",
            label: "Absenteísmo",
            href: "/dashboards/clientes/enjoei/absenteismo",
            palavrasChave: ["enjoei", "falta", "presenca", "ponto", "aderencia", "absenteismo"],
            icone: CalendarX,
          },
        ],
      },
    ],
  },
]

/** Oculta módulos da navegação sem alterar as chaves de permissão existentes. */
export const DOMINIOS_OCULTOS = new Set(["rh", "treinamentos", "financeiro", "epi"])
export const DOMINIOS_NAVEGACAO = DOMINIOS.filter((dominio) => !DOMINIOS_OCULTOS.has(dominio.key))

export type TelaComDominio = Tela & {
  dominioKey: string
  dominioLabel: string
  /** Preenchido só para telas dentro de um cliente contratante (área Clientes). */
  clienteKey?: string
  clienteLabel?: string
}

/** A Home não pertence a domínio nenhum: é o painel de entrada. */
export const TELA_HOME: TelaComDominio = {
  key: "home",
  label: "Início",
  href: "/dashboards",
  palavrasChave: ["inicio", "home", "pulso", "mission control"],
  dominioKey: "geral",
  dominioLabel: "Geral",
  icone: LayoutDashboard,
}

export const TODAS_AS_TELAS: TelaComDominio[] = [
  TELA_HOME,
  ...DOMINIOS.flatMap((dominio) => [
    ...dominio.telas.map((tela) => ({
      ...tela,
      dominioKey: dominio.key,
      dominioLabel: dominio.label,
    })),
    // Telas aninhadas por cliente (área Clientes) também entram na fonte de verdade:
    // valem para permissões (visibleScreens), busca e guard de rota.
    ...(dominio.clientes ?? []).flatMap((cliente) =>
      cliente.telas.map((tela) => ({
        ...tela,
        dominioKey: dominio.key,
        dominioLabel: dominio.label,
        clienteKey: cliente.key,
        clienteLabel: cliente.label,
      })),
    ),
  ]),
]

/** Um cliente com apenas as telas prontas e concedidas ao usuário. */
export type ClienteHubVisivel = {
  key: string
  label: string
  icone?: LucideIcon
  telas: Tela[]
}

/**
 * Clientes de um domínio (área Clientes) com as telas filtradas: sem `emBreve` e só
 * as concedidas (`visibleScreens`; null = admin/dev vê tudo). Clientes sem nenhuma
 * tela visível são omitidos — assim o cliente só aparece quando o usuário tem tela
 * dele.
 */
export function clientesVisiveis(
  dominio: Dominio,
  visibleScreens: string[] | null,
): ClienteHubVisivel[] {
  const permitidas = visibleScreens ? new Set(visibleScreens) : null
  return (dominio.clientes ?? [])
    .map((cliente) => ({
      key: cliente.key,
      label: cliente.label,
      icone: cliente.icone,
      telas: cliente.telas
        .filter((tela) => !tela.emBreve)
        .filter((tela) => permitidas === null || permitidas.has(tela.key)),
    }))
    .filter((cliente) => cliente.telas.length > 0)
}

/** Remove acento e caixa: a busca não pode exigir digitação perfeita. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

/**
 * Busca sobre INDICADORES, não só sobre páginas — digitar "vencimento" precisa
 * levar à matriz de competências. Telas "em breve" também aparecem, para o
 * usuário enxergar o mapa do produto.
 */
export function buscarTelas(termo: string): TelaComDominio[] {
  const alvo = normalizar(termo)
  if (!alvo) return []
  return TODAS_AS_TELAS.filter((tela) => !DOMINIOS_OCULTOS.has(tela.dominioKey) && tela.key !== "home").filter((tela) => {
    const campos = [tela.label, tela.dominioLabel, ...(tela.palavrasChave ?? [])]
    return campos.some((campo) => normalizar(campo).includes(alvo))
  })
}

export type PermissaoUsuario = { isAdmin: boolean; visibleScreens: string[] }

/** Admin enxerga tudo; os demais, apenas o que foi concedido e ainda existe. */
export function telasVisiveis(usuario: PermissaoUsuario): TelaComDominio[] {
  const habilitadas = TODAS_AS_TELAS.filter((tela) => !tela.emBreve)
  if (usuario.isAdmin) return habilitadas
  const concedidas = new Set(usuario.visibleScreens)
  return habilitadas.filter((tela) => concedidas.has(tela.key))
}

/** Chaves válidas — usado para limpar o que vem do banco. */
export const CHAVES_DE_TELA = TODAS_AS_TELAS.map((tela) => tela.key)

export function sanitizarTelas(entrada: unknown): string[] {
  if (!Array.isArray(entrada)) return []
  const validas = new Set(CHAVES_DE_TELA)
  return Array.from(
    new Set(
      entrada.filter((v): v is string => typeof v === "string" && (validas.has(v) || /^cliente-bi:[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v.slice(11))))),
    ),
  )
}
