"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chartColors";

interface DonutDatum {
  name: string;
  value: number;
}

interface SimpleDonutChartProps {
  data: DonutDatum[];
  height?: number;
}

export function SimpleDonutChart({ data, height = 240 }: SimpleDonutChartProps) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>No data yet</div>;
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          strokeWidth={2}
          stroke="var(--card)"
        >
          {data.map((d, i) => (
            <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => {
            const n = Number(value) || 0;
            return [`${n} (${total ? Math.round((n / total) * 100) : 0}%)`, name];
          }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
