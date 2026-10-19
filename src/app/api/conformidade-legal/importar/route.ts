import { NextRequest, NextResponse } from "next/server"
import { guardAdmin } from "@/lib/admin-guard"
import { ErroArquivoImportacao, importarConformidadeLegal, LIMITE_ARQUIVO_CONFORMIDADE } from "@/lib/conformidade-legal-importacao"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function mesmaOrigem(request: NextRequest) {
  const origin = request.headers.get("origin")
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (!origin || !host) return false
  try { return new URL(origin).host.toLowerCase() === host.split(",")[0].trim().toLowerCase() }
  catch { return false }
}

export async function POST(request: NextRequest) {
  if (!mesmaOrigem(request)) return NextResponse.json({ error: "Origem da requisição inválida." }, { status: 403 })
  const guarda = await guardAdmin()
  if (!guarda.ok) return guarda.response

  if (!process.env.EPI_CPF_SECRET) return NextResponse.json({ error: "A importação está indisponível por falta de configuração." }, { status: 503 })
  const length = Number(request.headers.get("content-length") ?? 0)
  if (length > LIMITE_ARQUIVO_CONFORMIDADE + 64 * 1024) return NextResponse.json({ error: "O arquivo excede o limite de 4 MB." }, { status: 413 })

  let form: FormData
  try { form = await request.formData() }
  catch { return NextResponse.json({ error: "Envie um arquivo XLSX válido." }, { status: 400 }) }
  const arquivo = form.get("arquivo")
  if (!(arquivo instanceof File)) return NextResponse.json({ error: "Selecione um arquivo XLSX." }, { status: 400 })
  if (!arquivo.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "O formato aceito é XLSX." }, { status: 415 })
  if (arquivo.size === 0 || arquivo.size > LIMITE_ARQUIVO_CONFORMIDADE) return NextResponse.json({ error: "O arquivo está vazio ou excede o limite de 4 MB." }, { status: 413 })

  try {
    const resultado = await importarConformidadeLegal(Buffer.from(await arquivo.arrayBuffer()), arquivo.name, process.env.EPI_CPF_SECRET)
    return NextResponse.json(resultado)
  } catch (error) {
    if (error instanceof ErroArquivoImportacao) return NextResponse.json({ error: error.message }, { status: 400 })
    // Erros do PostgreSQL e da infraestrutura podem conter SQL, host ou detalhes internos.
    return NextResponse.json({ error: "Não foi possível concluir a importação. Nenhuma carga parcial foi publicada." }, { status: 500 })
  }
}
