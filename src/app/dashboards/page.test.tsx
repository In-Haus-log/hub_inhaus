import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.stubGlobal("React", React)

import DashboardsHome from "./page"

describe("home do hub", () => {
  it("mostra apenas uma mensagem de boas-vindas sem exigir telas liberadas", () => {
    const html = renderToStaticMarkup(React.createElement(DashboardsHome))

    expect(html).toContain("Bem-vindo!")
    expect(html).toContain("Que bom ter você por aqui. Seu ambiente de trabalho está pronto.")
    expect(html).not.toMatch(/indicador|segurança|qualidade|financeiro/i)
    expect(html).not.toContain("<a ")
  })
})
