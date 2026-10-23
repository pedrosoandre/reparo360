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
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-[color:var(--color-primary)] text-white shadow-[0_8px_24px_-8px_rgba(79,107,255,0.5)]"
                  : "text-[color:var(--color-muted)] hover:text-white hover:bg-white/[0.04]",
              )}
            >
              <span className="relative shrink-0">
                <it.icon size={17} />
                {"dot" in it && it.dot && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[color:var(--color-danger)]" />
                )}
              </span>
              <span className="truncate flex-1">{it.label}</span>
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

      <div className="flex-1" />

      <button
        onClick={() => {
          toast("Promoção de troca de óleo — em breve na sua oficina parceira.");
          onNavigate?.();
        }}
        className="premium-card-flat p-4 text-left group hover:border-white/[0.14] transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F5A524]/25 to-[#F59E0B]/10 border border-[#F5A524]/25 flex items-center justify-center">
            <Droplet size={16} className="text-[#F5A524]" />
          </div>
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[#F5A524]/20 text-[#F5A524] border border-[#F5A524]/30">
            -25%
          </span>
        </div>
        <p className="font-semibold text-sm">Troca de óleo</p>
        <p className="text-[11px] text-[color:var(--color-muted)] mt-0.5 leading-relaxed">
          Óleo + filtro por R$ 149 na semana.
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-white/80 group-hover:text-white transition-colors">
          Ver oferta <ChevronRight size={12} />
        </span>
      </button>

      <div className="rounded-2xl p-4 bg-[color:var(--color-primary)] relative overflow-hidden">
        <span className="absolute top-2 right-2 text-[8px] uppercase tracking-wider text-white/60">
          Anúncio
        </span>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center">
            <ShieldCheck size={14} className="text-white" />
          </div>
          <p className="font-semibold text-sm leading-tight">GaraGO Seguros</p>
        </div>
        <p className="text-xs text-white/85 leading-snug">
          Seu carro coberto por <span className="font-semibold text-white">R$ 89/mês</span>. Cotação em 2 minutos.
        </p>
        <button
          onClick={() => {
            toast("GaraGO Seguros — em breve integração com cotação.");
            onNavigate?.();
          }}
          className="mt-3 w-full h-11 bg-[#141414] text-[color:var(--color-text)] text-label font-semibold hover:bg-black transition-colors"
        >
          Fazer cotação
        </button>
      </div>
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
    <aside className="premium-card p-4 hidden lg:flex flex-col gap-5 lg:h-full">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          title="Voltar ao dashboard"
          aria-label="Voltar ao dashboard"
          className="flex items-center gap-3 min-w-0 flex-1 group"
        >
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-500 to-slate-800 border border-white/10 group-hover:border-white/30 transition-colors flex items-center justify-center font-semibold text-white shrink-0 text-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate group-hover:text-white transition-colors">
              {displayName}
            </p>
            <p className="text-[11px] mt-1 text-[color:var(--color-muted)] flex items-center gap-1">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">
                {user?.city ? (
                  <span className="text-white font-medium">{user.city}</span>
                ) : (
                  <span className="italic">Sem cidade</span>
                )}
              </span>
            </p>
          </div>
        </Link>
        <Link
          href="/configuracoes"
          title="Editar perfil"
          aria-label="Editar perfil"
          className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-[color:var(--color-muted)] hover:text-white transition-colors flex items-center justify-center shrink-0"
        >
          <Settings size={14} />
        </Link>
      </div>

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
