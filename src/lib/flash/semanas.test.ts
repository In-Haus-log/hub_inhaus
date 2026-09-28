import { describe, expect, it } from "vitest"
import { mesParaData, periodoAnterior, rotuloPeriodo, semanaDoMes, semanasDoMes } from "./semanas"

describe("semanas do mês", () => {
  it("dia 1–7 = semana 1, 8–14 = 2, 29–31 = 5", () => {
    expect(semanaDoMes(new Date("2026-09-01T12:00:00-03:00"))).toEqual({ mes: "2026-09", semana: 1 })
    expect(semanaDoMes(new Date("2026-09-08T12:00:00-03:00"))).toEqual({ mes: "2026-09", semana: 2 })
    expect(semanaDoMes(new Date("2026-09-30T12:00:00-03:00"))).toEqual({ mes: "2026-09", semana: 5 })
  })
  it("usa o fuso de São Paulo (23h do dia 7 local ainda é semana 1)", () => {
    expect(semanaDoMes(new Date("2026-09-08T01:30:00Z"))).toEqual({ mes: "2026-09", semana: 1 })
  })
  it("fevereiro de 28 dias tem 4 semanas; setembro tem 5", () => {
    expect(semanasDoMes("2026-02")).toEqual([1, 2, 3, 4])
    expect(semanasDoMes("2026-09")).toEqual([1, 2, 3, 4, 5])
  })
  it("semana anterior da semana 1 é a última do mês anterior", () => {
    expect(periodoAnterior({ mes: "2026-03", semana: 1 })).toEqual({ mes: "2026-02", semana: 4 })
    expect(periodoAnterior({ mes: "2026-01", semana: 1 })).toEqual({ mes: "2025-12", semana: 5 })
    expect(periodoAnterior({ mes: "2026-09", semana: 3 })).toEqual({ mes: "2026-09", semana: 2 })
  })
  it("rótulo e data", () => {
    expect(rotuloPeriodo({ mes: "2026-09", semana: 2 })).toBe("Set/2026 · Semana 2")
    expect(mesParaData("2026-09")).toBe("2026-09-01")
  })
})
