import { notFound } from "next/navigation"
import { resolverPapeisDashboard } from "@/lib/dashboard-acesso"
import { GerenciadorPowerBi } from "@/components/powerbi/GerenciadorPowerBi"

export default async function RelatorioClientePage({ params }: { params: { id: string; relatorioId: string } }) {
  const clienteId = Number(params.id)
  const painelId = Number(params.relatorioId)
  const papeis = await resolverPapeisDashboard()
  const cliente = papeis.clientesBi?.find(c => c.id === clienteId)
  if (!Number.isSafeInteger(clienteId) || !Number.isSafeInteger(painelId) || !cliente?.relatorios?.some(p => p.id === painelId)) notFound()
  return <GerenciadorPowerBi clienteId={clienteId} painelId={painelId} podeGerenciar={false} />
}
