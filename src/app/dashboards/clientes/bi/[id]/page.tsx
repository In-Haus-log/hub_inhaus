import { notFound, redirect } from "next/navigation"
import { resolverPapeisDashboard } from "@/lib/dashboard-acesso"
import { GerenciadorPowerBi } from "@/components/powerbi/GerenciadorPowerBi"
import { rotaRelatorioBi } from "@/lib/powerbi-permissoes"

export default async function ClienteBiPage({ params }: { params: { id: string } }) {
  const id = Number(params.id)
  const papeis = await resolverPapeisDashboard()
  const cliente = papeis.clientesBi?.find(c => c.id === id)
  if (!Number.isSafeInteger(id) || !cliente) notFound()
  if (cliente.relatorios?.[0]) redirect(rotaRelatorioBi(id,cliente.relatorios[0].id))
  return <GerenciadorPowerBi clienteId={id} podeGerenciar={false} />
}
