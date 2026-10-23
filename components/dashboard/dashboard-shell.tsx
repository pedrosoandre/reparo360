"use client";

import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileProfileHeader } from "@/components/dashboard/mobile-profile-header";
import { useAuthHydrated, useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";

interface DashboardShellProps {
  children: React.ReactNode;
  /** Coluna à direita opcional (ex.: GeneralInfo no dashboard). */
  aside?: React.ReactNode;
  /** Coluna central fixa (não scroll). Defaultea a false — deixe padrão. */
  scrollableMain?: boolean;
}

/**
 * Shell comum de todas as telas autenticadas: sidebar à esquerda, conteúdo
 * central e coluna auxiliar opcional. Substitui o layout inline do /dashboard
 * pra reusar em /veiculos, /documentos, etc.
 */
export function DashboardShell({ children, aside, scrollableMain = true }: DashboardShellProps) {
  const hydrated = useAuthHydrated();
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const ensureLocalUser = useAuthStore((s) => s.ensureLocalUser);

  useEffect(() => {
    if (hydrated && !currentUserId) ensureLocalUser();
  }, [hydrated, currentUserId, ensureLocalUser]);

  const gridCols = aside
    ? "lg:grid-cols-[240px_1fr_320px] xl:grid-cols-[260px_1fr_340px]"
    : "lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr]";

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col">
      <MobileProfileHeader />
      <div className="flex-1 min-h-0 w-full p-2 sm:p-3 md:p-4 bg-gradient-to-b from-[color:var(--color-surface)] to-[color:var(--color-surface)]">
        <div className={`grid grid-cols-1 ${gridCols} gap-3 sm:gap-4 lg:h-full lg:min-h-0`}>
          <div className="hidden lg:block order-2 lg:order-1 lg:min-h-0">
            <Sidebar />
          </div>
          <div
            className={`order-1 lg:order-2 min-w-0 lg:min-h-0 ${
              scrollableMain ? "lg:overflow-y-auto" : ""
            }`}
          >
            {children}
          </div>
          {aside && <div className="order-3 lg:min-h-0">{aside}</div>}
        </div>
      </div>

      <footer className="w-full border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] shrink-0">
        <div className="px-3 sm:px-4 md:px-5 py-2 flex flex-wrap items-center justify-center md:justify-between gap-3 text-xs text-[color:var(--color-muted)]">
          <span className="opacity-60">© {new Date().getFullYear()} Reparo360</span>
          <nav className="flex flex-wrap items-center gap-4 sm:gap-6">
            <a className="hover:text-[color:var(--color-text)] transition-colors cursor-pointer">Sobre</a>
            <a className="hover:text-[color:var(--color-text)] transition-colors cursor-pointer">Política de privacidade</a>
            <a className="hover:text-[color:var(--color-text)] transition-colors cursor-pointer">Informações legais</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
