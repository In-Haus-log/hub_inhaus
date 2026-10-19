import { redirect } from "next/navigation"
import { resolverPapeisDashboard } from "@/lib/dashboard-acesso"
import { GerenciadorPowerBi } from "@/components/powerbi/GerenciadorPowerBi"

export default async function RelatoriosAdminPage({ searchParams }: { searchParams: { cliente?: string } }) {
  const papeis = await resolverPapeisDashboard()
  if (!papeis.isAdmin && !papeis.isAnalista) redirect("/dashboards")
  const id = Number(searchParams.cliente)
  const clienteInicialId = Number.isSafeInteger(id) && papeis.clientesBi?.some(c => c.id === id) ? id : undefined
  return <GerenciadorPowerBi modo="relatorios" podeGerenciar clienteInicialId={clienteInicialId} />
}
