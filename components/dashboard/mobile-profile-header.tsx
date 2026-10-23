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
      <header className="lg:hidden sticky top-0 z-30 bg-[color:var(--color-surface)]/85 backdrop-blur border-b border-[color:var(--color-border)]">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Link
            href="/dashboard"
            title="Voltar ao dashboard"
            aria-label="Voltar ao dashboard"
            className="flex items-center gap-2.5 min-w-0 flex-1 group"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-500 to-slate-800 border border-[color:var(--color-border)] group-hover:border-[color:var(--color-border-strong)] transition-colors flex items-center justify-center font-semibold text-[color:var(--color-text)] shrink-0 text-label">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-body truncate leading-tight group-hover:text-[color:var(--color-text)] transition-colors">
                {displayName}
              </p>
              <p className="text-meta text-[color:var(--color-muted)] mt-0.5 flex items-center gap-1.5">
                <MapPin size={12} className="shrink-0" />
                <span className="truncate">
                  {user?.city ? (
                    <span className="text-[color:var(--color-text)] font-medium">{user.city}</span>
                  ) : (
                    <span className="italic">Cidade não definida</span>
                  )}
                </span>
              </p>
            </div>
          </Link>
          {/* O círculo visível tem 40px pra emparelhar com o avatar, mas o alvo
              de toque se estende 4px além por um pseudo-elemento: a marca fica
              discreta sem o dedo precisar de pontaria. */}
          <button
            onClick={openMenu}
            title="Abrir menu"
            aria-label="Abrir menu"
            className="relative w-10 h-10 rounded-full bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-3)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] transition-colors flex items-center justify-center shrink-0 after:absolute after:-inset-1 after:content-['']"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>
      <MobileMenuDrawer />
    </>
  );
}
