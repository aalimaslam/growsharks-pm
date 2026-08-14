// Validated categorical chart palette (dataviz skill) — fixed order, referenced
// via CSS vars so light/dark swap automatically. Assign in order, never cycle
// past slot 8 (fold extra categories into "Other" instead).
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

export const CHART_INCOME_COLOR = "var(--accent-blue)";
export const CHART_EXPENSE_COLOR = "var(--destructive)";
export const CHART_MUTED_COLOR = "var(--muted-foreground)";
export const CHART_GRID_COLOR = "var(--border)";
