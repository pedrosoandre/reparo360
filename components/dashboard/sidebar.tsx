"use client";

import {
  Wrench,
  ShieldCheck,
  FileText,
  Car,
  Trash2,
  Settings,
  ChevronRight,
  Receipt,
  Droplet,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/stores/auth-store";
import { useBudgetsStore } from "@/stores/budgets-store";
import { useUIStore } from "@/stores/ui-store";
import { toast } from "@/stores/toast-store";

const NAV = [
  { icon: Wrench, label: "Avaliação de danos", href: "/dashboard" },
  { icon: Receipt, label: "Meus orçamentos", href: "/orcamentos" },
  { icon: Car, label: "Meus veículos", href: "/veiculos" },
  { icon: Trash2, label: "Rascunhos", href: "/rascunhos" },
  { icon: FileText, label: "Meus documentos", href: "/documentos" },
  { icon: ShieldCheck, label: "Seguro válido", href: "/seguro", dot: true },
  { icon: Settings, label: "Configurações", href: "/configuracoes" },
];

/**
 * Nav + promos, reusado no `Sidebar` (desktop) e no `MobileMenuDrawer`. Fecha
 * o drawer ao navegar pra não ficar preso após clique.
 */
export function SidebarBody({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const allBudgets = useBudgetsStore((s) => s.budgets);
  const drafts = useMemo(
    () =>
      user
        ? allBudgets.filter((b) => b.userId === user.id && b.status === "draft")
        : [],
    [allBudgets, user],
  );

  return (
    <>
      <nav className="flex flex-col gap-1">
        {NAV.map((it) => {
          const active =
            pathname === it.href ||
            (it.href !== "/dashboard" && pathname.startsWith(`${it.href}/`));
          const badge = it.href === "/rascunhos" && drafts.length > 0 ? drafts.length : undefined;
          return (
            <Link
              key={it.label}
              href={it.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-label transition-colors",
                active
                  ? "bg-[color:var(--color-primary)] text-[color:var(--color-on-accent)] font-semibold"
                  : "text-[color:var(--color-sidebar-muted)] hover:text-[color:var(--color-sidebar-text)] hover:bg-white/[0.06]",
              )}
            >
              <span className="relative shrink-0">
                <it.icon size={17} />
                {"dot" in it && it.dot && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[color:var(--color-warning)]" />
                )}
              </span>
              <span className="truncate flex-1">{it.label}</span>
              {/* A seta marca onde você está — é o sinal do mockup, e some
                  quando o item não é o ativo. */}
              {active && <span aria-hidden className="shrink-0">→</span>}
              {badge !== undefined && (
                <span
                  className={cn(
                    "min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
                    active
                      ? "bg-white/25 text-white"
                      : "bg-[color:var(--color-danger)] text-white",
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

    </>
  );
}

export function Sidebar() {
  const user = useCurrentUser();
  const displayName = user?.name || "Você";
  const initials =
    displayName
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  // No mobile a sidebar sai da tela: perfil vive no `MobileProfileHeader` e
  // nav+promo abrem via botão no `MobileMenuDrawer`. `hidden lg:flex` evita
  // duplicar layout em telas pequenas.
  return (
    // A barra fica preta no tema claro — é assim no mockup, e é o contraste que
    // dá a leitura de pista: faixa escura à esquerda, papel à direita. Por isso
    // ela não usa `premium-card`, que agora é papel.
    <aside className="p-4 hidden lg:flex flex-col gap-5 lg:h-full bg-[color:var(--color-sidebar)]">
      {/* Logotipo: nome em condensada itálica, "360" em bloco vermelho. É a
          primeira coisa da barra no mockup. */}
      <Link
        href="/dashboard"
        aria-label="Reparo360 — ir para o dashboard"
        className="inline-flex items-baseline self-start text-[22px] leading-none"
        style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 800 }}
      >
        <span className="text-[color:var(--color-sidebar-text)]">REPARO</span>
        <span className="ml-[.12em] bg-[color:var(--color-primary)] px-[.2em] text-[color:var(--color-on-accent)]">360</span>
      </Link>
      <SidebarBody />
    </aside>
  );
}

/**
 * Overlay full-screen no mobile com o `SidebarBody`. Botão de trigger fica no
 * `MobileProfileHeader`; abertura vive no `useUIStore` pra qualquer trigger
 * futuro poder fechar/abrir sem prop drilling.
 */
export function MobileMenuDrawer() {
  const open = useUIStore((s) => s.mobileMenuOpen);
  const close = useUIStore((s) => s.closeMobileMenu);

  useEffect(() => {
    if (!open) return;
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button
        aria-label="Fechar menu"
        onClick={close}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <aside className="absolute left-0 top-0 bottom-0 w-[86%] max-w-[320px] bg-[#0F1116] border-r border-white/[0.06] p-4 flex flex-col gap-5 overflow-y-auto drawer-slide-in">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
            Menu
          </p>
          <button
            onClick={close}
            aria-label="Fechar menu"
            className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-[color:var(--color-muted)] hover:text-white flex items-center justify-center transition-colors"
          >
            <ChevronRight size={16} className="rotate-180" />
          </button>
        </div>
        <SidebarBody onNavigate={close} />
      </aside>
    </div>
  );
}
