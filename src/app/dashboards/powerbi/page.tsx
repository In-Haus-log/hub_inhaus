import { redirect } from "next/navigation"

export default async function PowerBiPage() {
  redirect("/dashboards/administracao/relatorios")
}
