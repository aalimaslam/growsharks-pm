"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CHART_GRID_COLOR, CHART_MUTED_COLOR } from "@/lib/chartColors";

export interface BarSeriesConfig {
  key: string;
  label: string;
  color: string;
}

interface SimpleBarChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: BarSeriesConfig[];
  height?: number;
}

export function SimpleBarChart({ data, xKey, series, height = 240 }: SimpleBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: CHART_MUTED_COLOR }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: CHART_MUTED_COLOR }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)" }}
          cursor={{ fill: "var(--muted)" }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={44} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
