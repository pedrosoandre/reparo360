"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { User } from "@/types";
import { uid, fakeHash } from "@/lib/ids";

const SESSION_COOKIE = "r360_session";
const SESSION_DAYS = 30;

function setSessionCookie(userId: string) {
  if (typeof document === "undefined") return;
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  document.cookie = `${SESSION_COOKIE}=${userId}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function clearSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

interface AuthState {
  users: User[];
  currentUserId: string | null;

  signup: (fields: { name: string; email: string; password: string; phone?: string }) => AuthResult;
  login: (email: string, password: string) => AuthResult;
  logout: () => void;
  updateProfile: (fields: Partial<Pick<User, "name" | "email" | "phone" | "city">>) => AuthResult;
  changePassword: (current: string, next: string) => AuthResult;
  wipeAll: () => void;
  /** Garante que exista um usuário local — cria um "convidado" se preciso. */
  ensureLocalUser: () => User;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: [],
      currentUserId: null,

      signup: ({ name, email, password, phone }) => {
        const normalized = email.trim().toLowerCase();
        if (!name.trim()) return { ok: false, error: "Informe seu nome." };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
          return { ok: false, error: "E-mail inválido." };
        }
        if (password.length < 4) {
          return { ok: false, error: "Senha precisa ter pelo menos 4 caracteres." };
        }
        const exists = get().users.find((u) => u.email === normalized);
        if (exists) return { ok: false, error: "Já existe uma conta com esse e-mail." };

        const user: User = {
          id: uid("usr"),
          name: name.trim(),
          email: normalized,
          phone: phone?.trim() || undefined,
          passwordHash: fakeHash(password),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ users: [...s.users, user], currentUserId: user.id }));
        setSessionCookie(user.id);
        return { ok: true };
      },

      login: (email, password) => {
        const normalized = email.trim().toLowerCase();
        const user = get().users.find((u) => u.email === normalized);
        if (!user) return { ok: false, error: "E-mail ou senha incorretos." };
        if (user.passwordHash !== fakeHash(password)) {
          return { ok: false, error: "E-mail ou senha incorretos." };
        }
        set({ currentUserId: user.id });
        setSessionCookie(user.id);
        return { ok: true };
      },

      logout: () => {
        set({ currentUserId: null });
        clearSessionCookie();
      },

      updateProfile: (fields) => {
        const id = get().currentUserId;
        if (!id) return { ok: false, error: "Sem sessão." };
        if (fields.email) {
          const email = fields.email.trim().toLowerCase();
          const conflict = get().users.find((u) => u.email === email && u.id !== id);
          if (conflict) return { ok: false, error: "Já existe uma conta com esse e-mail." };
          fields.email = email;
        }
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, ...fields } : u)),
        }));
        return { ok: true };
      },

      changePassword: (current, next) => {
        const id = get().currentUserId;
        if (!id) return { ok: false, error: "Sem sessão." };
        const user = get().users.find((u) => u.id === id);
        if (!user) return { ok: false, error: "Usuário não encontrado." };
        if (user.passwordHash !== fakeHash(current)) {
          return { ok: false, error: "Senha atual incorreta." };
        }
        if (next.length < 4) return { ok: false, error: "Nova senha muito curta." };
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id ? { ...u, passwordHash: fakeHash(next) } : u,
          ),
        }));
        return { ok: true };
      },

      wipeAll: () => {
        clearSessionCookie();
        set({ users: [], currentUserId: null });
        if (typeof window !== "undefined") {
          const keys = Object.keys(window.localStorage).filter((k) =>
            k.startsWith("reparo360:"),
          );
          keys.forEach((k) => window.localStorage.removeItem(k));
        }
      },

      ensureLocalUser: () => {
        const state = get();
        if (state.currentUserId) {
          const existing = state.users.find((u) => u.id === state.currentUserId);
          if (existing) return existing;
        }
        // Se já tem usuários e nenhum selecionado, reusa o primeiro
        if (state.users.length > 0) {
          const first = state.users[0];
          set({ currentUserId: first.id });
          setSessionCookie(first.id);
          return first;
        }
        // Cria um usuário local sem senha (login opcional pra depois)
        const user: User = {
          id: uid("usr"),
          name: "Você",
          email: "local@reparo360",
          passwordHash: "",
          createdAt: new Date().toISOString(),
        };
        set({ users: [user], currentUserId: user.id });
        setSessionCookie(user.id);
        return user;
      },
    }),
    {
      name: "reparo360:auth",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Reconcilia cookie com o estado ao reidratar — útil quando o user
        // limpou cookies mas o localStorage ainda tem currentUserId.
        if (state?.currentUserId) setSessionCookie(state.currentUserId);
      },
    },
  ),
);

/** Hook helper: usuário atualmente logado (ou null). */
export function useCurrentUser(): User | null {
  return useAuthStore((s) => {
    if (!s.currentUserId) return null;
    return s.users.find((u) => u.id === s.currentUserId) ?? null;
  });
}

/**
 * Indica se o zustand persist já terminou de reidratar do localStorage.
 * Sempre começa false (client + server) pra evitar hydration mismatch;
 * vira true no primeiro effect + no evento onFinishHydration.
 */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return () => unsub();
  }, []);
  return hydrated;
}
