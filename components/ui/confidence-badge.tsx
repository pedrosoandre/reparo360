import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export function ConfidenceBadge({ value }: { value: number }) {
  const level =
    value >= 80 ? "high" : value >= 60 ? "medium" : "low";
  const styles = {
    high: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] border-[color:var(--color-success)]/30",
    medium: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30",
    low: "bg-[color:var(--color-danger)]/15 text-[color:var(--color-danger)] border-[color:var(--color-danger)]/30",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 border",
        styles[level],
      )}
    >
      <Sparkles size={12} />
      Confiança {value}%
    </span>
  );
}
