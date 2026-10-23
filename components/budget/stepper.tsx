"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Veículo", "Peças", "Danos", "Fotos", "Resumo"];

export function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-label font-semibold transition-all",
                done && "bg-[color:var(--color-primary)] text-[color:var(--color-on-accent)]",
                active && "bg-[color:var(--color-primary)]/20 text-[color:var(--color-primary-soft)] ring-2 ring-[color:var(--color-primary)]/40",
                !done && !active && "bg-[color:var(--color-surface)] text-text-secondary",
              )}
            >
              {done ? <Check size={14} /> : i + 1}
            </div>
            <span className={cn("text-label hidden md:inline", active ? "text-text" : "text-text-secondary")}>
              {label}
            </span>
            {/* Conector mais curto no celular: cinco passos com 24px entre
                eles não cabem em 375px. */}
            {i < STEPS.length - 1 && <div className="w-4 sm:w-6 md:w-10 h-px bg-[color:var(--color-border)]" />}
          </div>
        );
      })}
    </div>
  );
}
