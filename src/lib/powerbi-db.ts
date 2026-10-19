import { Client } from "pg"

// Cadastros usam a conexão de autorização do hub. As consultas são pontuais;
// encerrar a conexão evita reaproveitar conexões ociosas encerradas pelo servidor.
export const powerbiDb = {
  async query(sql: string, valores: unknown[] = []) {
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 })
    try {
      await client.connect()
      return await client.query(sql, valores)
    } catch (erro) {
      console.error("Conexão Power BI", { codigo: (erro as {code?: string}).code, mensagem: (erro as Error).message })
      throw erro
    } finally { await client.end() }
  },
}
