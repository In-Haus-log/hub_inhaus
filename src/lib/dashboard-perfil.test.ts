import { describe, expect, it } from "vitest"
import { preenchedorExclusivo } from "./dashboard-perfil"

describe("perfil de preenchimento e demais indicadores", () => {
  const lider = { epiValida: true, epiConfig: false, isAdmin: false, visibleScreens: [] }
  it("mantém a experiência exclusiva para líder sem outros acessos", () => {
    expect(preenchedorExclusivo(lider)).toBe(true)
  })
  it("mantém a navegação para cliente BI ou indicador interno concedido", () => {
    for (const tela of ["cliente-bi:42", "conformidade-legal", "home"]) {
      expect(preenchedorExclusivo({ ...lider, visibleScreens: [tela] })).toBe(false)
    }
  })
  it("não restringe administradores, analistas ou configuradores", () => {
    expect(preenchedorExclusivo({ ...lider, isAdmin: true })).toBe(false)
    expect(preenchedorExclusivo({ ...lider, isAnalista: true })).toBe(false)
    expect(preenchedorExclusivo({ ...lider, epiConfig: true })).toBe(false)
  })
})
