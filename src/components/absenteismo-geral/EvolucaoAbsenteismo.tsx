"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DadosAbsenteismo } from "@/lib/absenteismo-geral";
const pct = (v: number) =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const dataBR = (valor: string) => {
  const partes = valor.slice(0, 10).split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}` : valor;
};
export function EvolucaoAbsenteismo({
  dados,
}: {
  dados: DadosAbsenteismo["porDia"];
}) {
  if (!dados.length)
    return (
      <p className="py-14 text-center text-sm text-muted-foreground">
        Sem registros de presença ou falta no período.
      </p>
    );
  return (
    <div
      role="img"
      aria-label="Evolução diária do percentual de absenteísmo"
      className="h-[280px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={dados}
          margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient
              id="absenteismo-geral-fill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#027193" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#027193" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(0,36,67,0.07)" vertical={false} />
          <XAxis
            dataKey="rotulo"
            tickFormatter={dataBR}
            tickLine={false}
            axisLine={false}
            minTickGap={18}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={42}
            tickFormatter={pct}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip
            formatter={(v) => [pct(Number(v)), "Absenteísmo"]}
            labelFormatter={(v) => `Dia ${dataBR(String(v))}`}
            contentStyle={{
              borderRadius: 12,
              borderColor: "rgba(0,36,67,.1)",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="absenteismo"
            stroke="#027193"
            strokeWidth={2.5}
            fill="url(#absenteismo-geral-fill)"
            dot={{ r: 2.5, fill: "#027193", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
