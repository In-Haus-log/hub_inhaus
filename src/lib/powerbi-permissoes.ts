export type ClienteBi = { id: number; nome: string; slug: string; relatorios?: { id: number; titulo: string; icone?: string }[] }
export const chaveClienteBi = (id: number) => `cliente-bi:${id}`
export const rotaClienteBi = (id: number) => `/dashboards/clientes/bi/${id}`
export const rotaRelatorioBi = (clienteId: number, relatorioId: number) => `${rotaClienteBi(clienteId)}/${relatorioId}`
export function idsClientesBi(telas: string[]): number[] {
  return Array.from(new Set(telas.filter(t => /^cliente-bi:[1-9]\d*$/.test(t))
    .map(t => Number(t.slice(11))).filter(Number.isSafeInteger)))
}
export function podeVerClienteBi(isAdmin: boolean, telas: string[], clienteId: number): boolean {
  return isAdmin || idsClientesBi(telas).includes(clienteId)
}
