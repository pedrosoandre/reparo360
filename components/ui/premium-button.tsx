"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface PremiumButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "ref"> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function PremiumButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: PremiumButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizes = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-5 text-sm",
    lg: "h-14 px-8 text-base",
  };

  const variants = {
    primary:
      "bg-[color:var(--color-primary)] text-[color:var(--color-on-accent)] shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] hover:bg-[color:var(--color-primary-glow)] hover:shadow-[0_12px_32px_-8px_rgba(59,130,246,0.7)]",
    secondary:
      "bg-[color:var(--color-card)] text-text border border-[color:var(--color-border)] hover:border-[color:var(--color-primary-soft)]",
    ghost: "text-text-secondary hover:text-text hover:bg-[color:var(--color-surface)]",
  };

  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className={cn(base, sizes[size], variants[variant], className)}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
