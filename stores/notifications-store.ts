"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { NotificationItem } from "@/types";
import { uid } from "@/lib/ids";

interface NotificationsState {
  notifications: NotificationItem[];

  push: (userId: string, input: Omit<NotificationItem, "id" | "userId" | "createdAt" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: (userId: string) => void;
  remove: (id: string) => void;
  forUser: (userId: string) => NotificationItem[];
  unreadCount: (userId: string) => number;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],

      push: (userId, input) => {
        const n: NotificationItem = {
          ...input,
          id: uid("ntf"),
          userId,
          read: false,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ notifications: [n, ...s.notifications].slice(0, 50) }));
      },

      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        })),

      markAllRead: (userId) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.userId === userId ? { ...n, read: true } : n,
          ),
        })),

      remove: (id) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      forUser: (userId) => get().notifications.filter((n) => n.userId === userId),
      unreadCount: (userId) =>
        get().notifications.filter((n) => n.userId === userId && !n.read).length,
    }),
    {
      name: "reparo360:notifications",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
