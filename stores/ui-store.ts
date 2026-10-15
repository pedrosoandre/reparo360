"use client";

import { create } from "zustand";

interface UIState {
  mobileMenuOpen: boolean;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  toggleMobileMenu: () => void;
}

/**
 * UI efêmero global. Só o menu mobile por enquanto — MobileProfileHeader abre
 * e a drawer/páginas fecham na navegação. Não persiste.
 */
export const useUIStore = create<UIState>((set) => ({
  mobileMenuOpen: false,
  openMobileMenu: () => set({ mobileMenuOpen: true }),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
}));
