import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glow?: boolean;
}

export function GlassCard({ children, glow, className, ...rest }: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass rounded-3xl p-5 transition-all duration-200",
        glow && "glow-primary",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
