"use client";

/**
 * Cabeçalho de perfil só pra mobile (< lg). No desktop o mesmo perfil vive
 * no topo do Sidebar; no mobile o Sidebar inteiro fica oculto e o menu abre
 * via botão-hambúrguer aqui → `MobileMenuDrawer`.
 *
 * O bloco equivalente dentro do Sidebar é escondido no mobile (`hidden lg:flex`)
 * pra não duplicar.
 */
import Link from "next/link";
import { MapPin, Menu } from "lucide-react";
import { useCurrentUser } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";
import { MobileMenuDrawer } from "@/components/dashboard/sidebar";

export function MobileProfileHeader() {
  const user = useCurrentUser();
  const openMenu = useUIStore((s) => s.openMobileMenu);
  const displayName = user?.name || "Você";
  const initials =
    displayName
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-[#0F1116]/85 backdrop-blur border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Link
            href="/dashboard"
            title="Voltar ao dashboard"
            aria-label="Voltar ao dashboard"
            className="flex items-center gap-2.5 min-w-0 flex-1 group"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-500 to-slate-800 border border-white/10 group-hover:border-white/30 transition-colors flex items-center justify-center font-semibold text-white shrink-0 text-xs">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate leading-tight group-hover:text-white transition-colors">
                {displayName}
              </p>
              <p className="text-[10px] text-[color:var(--color-muted)] leading-tight mt-0.5 flex items-center gap-1">
                <MapPin size={10} className="shrink-0" />
                <span className="truncate">
                  {user?.city ? (
                    <span className="text-white font-medium">{user.city}</span>
                  ) : (
                    <span className="italic">Cidade não definida</span>
                  )}
                </span>
              </p>
            </div>
          </Link>
          <button
            onClick={openMenu}
            title="Abrir menu"
            aria-label="Abrir menu"
            className="w-9 h-9 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-[color:var(--color-muted)] hover:text-white transition-colors flex items-center justify-center shrink-0"
          >
            <Menu size={17} />
          </button>
        </div>
      </header>
      <MobileMenuDrawer />
    </>
  );
}
