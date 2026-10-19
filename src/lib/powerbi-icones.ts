export const ICONES_BI = [
  { value: "layout-dashboard", label: "Painel" },
  { value: "chart-column", label: "Gráfico de barras" },
  { value: "chart-line", label: "Evolução" },
  { value: "chart-pie", label: "Distribuição" },
  { value: "package", label: "Estoque" },
  { value: "truck", label: "Transporte" },
  { value: "warehouse", label: "Almoxarifado" },
  { value: "wrench", label: "Manutenção" },
  { value: "clipboard-check", label: "Checklist" },
  { value: "wallet", label: "Financeiro" },
  { value: "users", label: "Pessoas" },
  { value: "factory", label: "Operação" },
] as const
export type IconeBi = (typeof ICONES_BI)[number]["value"]
export const ICONE_BI_PADRAO: IconeBi = "layout-dashboard"
export const CHAVES_ICONES_BI = ICONES_BI.map(i => i.value) as [IconeBi, ...IconeBi[]]
