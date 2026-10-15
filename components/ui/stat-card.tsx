import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { GlassCard } from "./glass-card";

interface StatCardProps {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  highlight?: boolean;
}

export function StatCard({ label, value, delta, hint, highlight }: StatCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <GlassCard
      className={cn(
        "flex flex-col gap-2",
        highlight && "bg-[color:var(--color-primary)]/10 border-[color:var(--color-primary)]/40",
      )}
    >
      <p className="text-xs uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="text-3xl font-semibold text-text tracking-tight">{value}</p>
      <div className="flex items-center justify-between">
        {hint && <p className="text-xs text-text-secondary">{hint}</p>}
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-1",
              positive
                ? "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]"
                : "bg-[color:var(--color-danger)]/15 text-[color:var(--color-danger)]",
            )}
          >
            {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {positive ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>
    </GlassCard>
  );
}
