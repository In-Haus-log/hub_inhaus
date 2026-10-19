import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "./middleware"
import { HEADER_PATHNAME } from "@/lib/http-headers"

afterEach(() => vi.unstubAllEnvs())

describe("rota atual no middleware do diretório src", () => {
  it("informa a página real ao layout, substituindo qualquer header recebido", () => {
    vi.stubEnv("HUB_ACESSO_LIVRE", "0")
    for (const path of ["/dashboards", "/dashboards/clientes/bi/6/1", "/dashboards/epi/lideres"]) {
      const request = new NextRequest(`https://hub.test${path}`, {
        headers: { cookie: "inhaus_access_token=token-de-teste", [HEADER_PATHNAME]: "/pagina-incorreta" },
      })
      const response = middleware(request)
      expect(response.headers.get(`x-middleware-request-${HEADER_PATHNAME}`)).toBe(path)
      expect(response.headers.get("location")).toBeNull()
    }
  })

  it("encaminha anônimos ao login antes de carregar o dashboard", () => {
    vi.stubEnv("HUB_ACESSO_LIVRE", "0")
    const response = middleware(new NextRequest("https://hub.test/dashboards"))
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login")
  })

  it("permite voltar ao login com cookie expirado sem criar outro ciclo", () => {
    vi.stubEnv("HUB_ACESSO_LIVRE", "0")
    const request = new NextRequest("https://hub.test/login", {
      headers: { cookie: "inhaus_access_token=token-expirado" },
    })
    expect(middleware(request).headers.get("location")).toBeNull()
  })
})
