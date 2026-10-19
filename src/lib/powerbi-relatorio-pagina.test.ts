import React from "react"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
vi.stubGlobal("React", React)
afterAll(() => vi.unstubAllGlobals())

const mocks = vi.hoisted(() => ({ papeis: vi.fn() }))
vi.mock("@/lib/dashboard-acesso", () => ({ resolverPapeisDashboard: mocks.papeis }))
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND") } }))
vi.mock("@/components/powerbi/GerenciadorPowerBi", () => ({ GerenciadorPowerBi: () => null }))
import Pagina from "@/app/dashboards/clientes/bi/[id]/[relatorioId]/page"

describe("rota individual do relatório do cliente", () => {
  beforeEach(() => mocks.papeis.mockResolvedValue({ clientesBi: [{ id: 1, nome: "Cliente A", slug: "a", relatorios: [{ id: 10, titulo: "Projeto A" }] }] }))
  it("abre apenas o relatório associado ao cliente autorizado", async () => {
    const pagina = await Pagina({ params: { id: "1", relatorioId: "10" } })
    expect(pagina.props).toMatchObject({ clienteId: 1, painelId: 10, podeGerenciar: false })
  })
  it("bloqueia outro relatório mesmo em um cliente autorizado", async () => {
    await expect(Pagina({ params: { id: "1", relatorioId: "20" } })).rejects.toThrow("NOT_FOUND")
  })
  it("bloqueia reutilizar o relatório na URL de outro cliente", async () => {
    await expect(Pagina({ params: { id: "2", relatorioId: "10" } })).rejects.toThrow("NOT_FOUND")
  })
})
