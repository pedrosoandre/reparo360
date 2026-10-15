import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Separa um valor já formatado em BRL (ex.: "R$ 1.234,56") em ["R$ 1.234", "56"] */
export function splitBRLCents(formatted: string): [string, string] {
  const idx = formatted.lastIndexOf(",");
  if (idx === -1) return [formatted, "00"];
  return [formatted.slice(0, idx), formatted.slice(idx + 1)];
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
