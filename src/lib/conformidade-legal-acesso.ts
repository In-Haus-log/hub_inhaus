import { acessoLivreLiberado } from "@/lib/dev-auth"
import { getSessionReadOnly } from "@/lib/auth-session"
import { type EscopoDados } from "@/lib/seguranca/escopo-dados"

/** Este indicador tem acesso integral por tela, sem exigir vínculos de CR.
 * As duas páginas verificam assertTelaVisivel antes de consultar os dados.
 */
export async function escopoConformidadeAtual(): Promise<EscopoDados> {
  if (acessoLivreLiberado()) return { tipo: "todos" }
  const resultado = await getSessionReadOnly()
  if (resultado.status !== "ok") return { tipo: "lista", crs: [] }
  return { tipo: "todos" }
}
