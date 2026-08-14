import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const accentClasses = {
  blue: "bg-accent-blue-soft text-accent-blue",
  violet: "bg-accent-violet-soft text-accent-violet",
  cyan: "bg-accent-cyan-soft text-accent-cyan",
  pink: "bg-accent-pink-soft text-accent-pink",
  amber: "bg-accent-amber-soft text-accent-amber",
} as const;

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  accent?: keyof typeof accentClasses;
  warn?: boolean;
}

export function KpiTile({ icon: Icon, label, value, accent = "blue", warn = false }: KpiTileProps) {
  return (
    <Card className="relative isolate">
      <CardContent className="flex items-center gap-3 py-2.5">
        <div
          aria-hidden
          className={cn("absolute inset-x-0 top-0 h-1", warn ? "bg-accent-pink" : accentClasses[accent])}
        />
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-md", accentClasses[accent])}>
          <Icon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-semibold leading-7 tracking-tight tabular-nums", warn && "text-accent-pink")}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
