import fs from "node:fs"
import pg from "pg"

const env = {}
for (const linha of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linha.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
}
const client = new pg.Client({ connectionString: env.DATABASE_URL || process.env.DATABASE_URL, connectionTimeoutMillis: 15000 })
try {
  await client.connect()
  await client.query(fs.readFileSync("prisma/sql/021_powerbi.sql", "utf8"))
  await client.query(fs.readFileSync("prisma/sql/022_powerbi_clientes.sql", "utf8"))
  await client.query(fs.readFileSync("prisma/sql/023_powerbi_documentacao.sql", "utf8"))
  const antes = await client.query("SELECT id,titulo,url,documentacao FROM dm_powerbi_painel ORDER BY id")
  await client.query(fs.readFileSync("prisma/sql/024_powerbi_cliente_direto.sql", "utf8"))
  await client.query(fs.readFileSync("prisma/sql/025_powerbi_icone.sql", "utf8"))
  const depois = await client.query("SELECT id,titulo,url,documentacao FROM dm_powerbi_painel ORDER BY id")
  if (JSON.stringify(antes.rows) !== JSON.stringify(depois.rows)) throw new Error("Os relatórios foram alterados durante a migração")
  console.log("Estrutura Power BI aplicada. Relatórios e documentação preservados.")
} catch (e) {
  console.error("Não foi possível aplicar a estrutura Power BI:", e.code || e.name)
  process.exitCode = 1
} finally { await client.end() }
