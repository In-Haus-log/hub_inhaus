"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Info, X } from "lucide-react"

import { cn } from "@/lib/utils"

function LegendaItem({
  cor,
  titulo,
  children,
}: {
  cor: string
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/60 bg-white/60 p-3">
      <span className={cn("mt-0.5 h-4 w-4 shrink-0 rounded-[5px]", cor)} aria-hidden />
      <div className="leading-relaxed">
        <p className="font-semibold text-foreground">{titulo}</p>
        <p className="mt-0.5 text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border/70 pt-6">
      <h3 className="font-display text-base font-semibold text-foreground">{titulo}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** Botão de informação que abre um modal com as regras de cálculo dos indicadores. */
export function RegrasInfo() {
  const [aberto, setAberto] = useState(false)
  const fecharRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto) return
    fecharRef.current?.focus()
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", onKey)
    }
  }, [aberto])

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Como os indicadores são calculados"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-enjoei/15 bg-white/70 text-enjoei transition-colors hover:bg-enjoei-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enjoei/30"
      >
        <Info className="h-4 w-4" />
      </button>

      {aberto &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-navy/40 backdrop-blur-sm"
              onClick={() => setAberto(false)}
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="regras-titulo"
              className="reveal relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-enjoei/10 bg-white p-7 shadow-soft sm:p-9"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="eyebrow">Regras de cálculo</span>
                  <h2 id="regras-titulo" className="mt-3 font-display text-2xl font-semibold">
                    Como os indicadores são calculados
                  </h2>
                </div>
                <button
                  ref={fecharRef}
                  type="button"
                  onClick={() => setAberto(false)}
                  aria-label="Fechar"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-enjoei-mist hover:text-enjoei focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enjoei/30"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
                <section>
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Fonte dos dados
                  </h3>
                  <p className="mt-3 text-muted-foreground">
                    Ponto real da Enjoei (unidade Cabreúva). Cada linha é um colaborador em um
                    dia. <b className="text-foreground">Todos os cargos entram</b> na análise —
                    sem exclusão de categoria profissional.
                  </p>
                  <p className="mt-3 rounded-xl bg-enjoei-mist/50 px-4 py-3 text-xs text-muted-foreground">
                    📌 O dia de <b className="text-foreground">hoje nunca entra</b> na conta — o
                    ponto do dia corrente ainda está em aberto. Os números sempre param no dia
                    anterior.
                  </p>
                </section>

                <Secao titulo="Desligamentos e recontratações">
                  <p className="text-muted-foreground">
                    A pessoa aparece nos indicadores até a sua <b className="text-foreground">data
                    de desligamento</b>, inclusive. A partir do dia seguinte, seus registros deixam
                    de compor o quadro e as taxas. Quando não há data de desligamento, o vínculo
                    continua aberto.
                  </p>
                  <p className="mt-3 text-muted-foreground">
                    O vínculo é conferido pela <b className="text-foreground">matrícula e pela
                    unidade</b>, respeitando as datas de admissão e desligamento registradas.
                  </p>
                </Secao>

                <Secao titulo="Presença, falta e folga">
                  <p className="text-muted-foreground">Classificação de cada dia:</p>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    <LegendaItem cor="bg-enjoei/85" titulo="Presença">
                      o colaborador bateu o ponto de <b className="text-foreground">entrada</b> (há
                      um horário, ex.: 08:04).
                    </LegendaItem>
                    <LegendaItem cor="bg-red-500/85" titulo="Falta">
                      a entrada está marcada como "FALTA".
                    </LegendaItem>
                    <LegendaItem cor="bg-amber-400/90" titulo="Férias">
                      a escala (<b className="text-foreground">H. contratual</b>) ou o motivo do dia
                      indicam "FÉRIAS".
                    </LegendaItem>
                    <LegendaItem cor="bg-slate-200/80" titulo="Folga">
                      a escala do dia (<b className="text-foreground">H. contratual</b>) está marcada
                      como "FOLGA" ou não há registro no dia.
                    </LegendaItem>
                  </div>
                  <p className="mt-4 rounded-xl bg-enjoei-mist/50 px-4 py-3 text-xs text-muted-foreground">
                    💡 Ao passar o mouse sobre um quadradinho, aparece o{" "}
                    <b className="text-foreground">motivo</b> (ex.: Atestado Médico) registrado
                    naquele dia.
                  </p>
                </Secao>

                <Secao titulo="Indicadores">
                  <dl className="space-y-3">
                    <div>
                      <dt className="font-semibold text-foreground">Colaboradores no mês</dt>
                      <dd className="mt-0.5 text-muted-foreground">
                        quantidade de colaboradores distintos com pelo menos um registro no ponto
                        no mês selecionado.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Escalados no dia</dt>
                      <dd className="mt-0.5 text-muted-foreground">
                        soma de presenças + faltas do dia. Não existe um quadro contratado fixo
                        para comparar — o próprio dia define quem estava escalado.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Aderência por dia</dt>
                      <dd className="mt-0.5 text-muted-foreground">
                        presenças ÷ escalados no dia, em %. Dias sem ninguém escalado ficam sem
                        barra.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Aderência do mês (card)</dt>
                      <dd className="mt-0.5 text-muted-foreground">
                        média das <b className="text-foreground">aderências diárias</b> do mês,
                        considerando apenas os dias com alguém escalado.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Faltas por dia</dt>
                      <dd className="mt-0.5 text-muted-foreground">
                        quantas faltas foram registradas em cada dia.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Absenteísmo por dia</dt>
                      <dd className="mt-0.5 text-muted-foreground">
                        faltas ÷ escalados no dia, em %. Exemplo: num dia com{" "}
                        <b className="text-foreground">40 pessoas escaladas</b> e 2 faltas, o
                        absenteísmo do dia é 5%.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Absenteísmo médio do mês</dt>
                      <dd className="mt-0.5 text-muted-foreground">
                        média das <b className="text-foreground">taxas diárias de absenteísmo</b>{" "}
                        (faltas ÷ escalados), considerando apenas os dias com operação. Dias{" "}
                        <b className="text-foreground">zerados</b> — sem ninguém escalado ou ainda
                        sem lançamento — não entram na conta e não diluem o resultado.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Presenças no período</dt>
                      <dd className="mt-0.5 text-muted-foreground">
                        cada quadradinho da grade é um dia de um colaborador.
                      </dd>
                    </div>
                  </dl>
                </Secao>

                <section className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 text-xs leading-relaxed text-muted-foreground">
                  <b className="text-foreground">Observação:</b> a presença considera hoje apenas a
                  batida de entrada — ainda não valida a saída, as horas trabalhadas nem faltas
                  justificadas (atestado, declaração de horas etc.).
                </section>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
