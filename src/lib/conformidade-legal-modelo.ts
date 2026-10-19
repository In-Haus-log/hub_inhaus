/** Contratos e rótulos compartilhados pelo servidor e pela interface. Sem dependências de runtime. */
export const TYPES_OCORRENCIA = [
  { key: "interjornada", label: "Interjornada" },
  { key: "limite_hr_dia", label: "Limite de horas diárias" },
  { key: "limite_hr_dia_excecao", label: "Horas diárias (exceção)" },
  { key: "folga_semanal", label: "Folga semanal" },
  { key: "x12x36_limite_ft_mes", label: "Folgas trabalhadas 12×36" },
  { key: "ferias_com_ponto", label: "Férias com ponto" },
] as const

export type LinhaConformidadeLegal = {
  mes: string
  cr: string | null
  crNome: string | null
  regional: string | null
  gerente: string | null
  supervisor: string | null
  funcao: string | null
  colaborador: string | null
  pessoaId: string | null
  interjornada: number | null
  limite_hr_dia: number | null
  limite_hr_dia_excecao: number | null
  folga_semanal: number | null
  x12x36_limite_ft_mes: number | null
  ferias_com_ponto: number | null
  total: number | null
}

export type DadosConformidadeLegal = { linhas: LinhaConformidadeLegal[]; atualizadoEm: string | null }
