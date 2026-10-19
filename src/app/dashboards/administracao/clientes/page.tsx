import { redirect } from "next/navigation"
import { resolverPapeisDashboard } from "@/lib/dashboard-acesso"
import { GerenciadorPowerBi } from "@/components/powerbi/GerenciadorPowerBi"

export default async function ClientesAdminPage() {
  const papeis = await resolverPapeisDashboard()
  if (!papeis.isAdmin && !papeis.isAnalista) redirect("/dashboards")
  return <GerenciadorPowerBi modo="clientes" podeGerenciar />
}
