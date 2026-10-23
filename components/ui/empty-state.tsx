"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-12 rounded-2xl border border-dashed border-[color:var(--color-border)]",
        className,
      )}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-[color:var(--color-surface)] flex items-center justify-center mb-4 text-[color:var(--color-muted)]">
          <Icon size={22} />
        </div>
      )}
      <h3 className="font-semibold text-sm">{title}</h3>
      {description && (
        <p className="text-xs text-[color:var(--color-muted)] mt-1 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
