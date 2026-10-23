"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bell, Check, X } from "lucide-react";
import { useCurrentUser } from "@/stores/auth-store";
import { useNotificationsStore } from "@/stores/notifications-store";
import { formatDate } from "@/lib/utils";

interface Props {
  onClose: () => void;
}

export function NotificationsPopover({ onClose }: Props) {
  const user = useCurrentUser();
  const all = useNotificationsStore((s) => s.notifications);
  const items = useMemo(
    () => (user ? all.filter((n) => n.userId === user.id) : []),
    [all, user],
  );
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const remove = useNotificationsStore((s) => s.remove);

  return (
    <div className="premium-card-flat shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--color-border)]">
        <span className="text-xs font-semibold">Notificações</span>
        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <button
              onClick={() => user && markAllRead(user.id)}
              className="text-[10px] text-[color:var(--color-primary-glow)] hover:brightness-125"
            >
              Marcar todas
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-6 h-6 rounded-md hover:bg-[color:var(--color-surface-3)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] flex items-center justify-center"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell size={20} className="mx-auto text-[color:var(--color-muted)] mb-2" />
            <p className="text-xs text-[color:var(--color-muted)]">
              Nada por aqui ainda.
            </p>
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-2 px-3 py-2.5 border-b border-[color:var(--color-border)] last:border-b-0 ${
                !n.read ? "bg-[color:var(--color-primary)]/5" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                {n.href ? (
                  <Link
                    href={n.href}
                    onClick={() => {
                      markRead(n.id);
                      onClose();
                    }}
                    className="block"
                  >
                    <p className="text-xs font-medium text-[color:var(--color-text)] truncate">{n.title}</p>
                    {n.body && (
                      <p className="text-[11px] text-[color:var(--color-muted)] truncate mt-0.5">
                        {n.body}
                      </p>
                    )}
                  </Link>
                ) : (
                  <>
                    <p className="text-xs font-medium text-[color:var(--color-text)]">{n.title}</p>
                    {n.body && (
                      <p className="text-[11px] text-[color:var(--color-muted)] mt-0.5">
                        {n.body}
                      </p>
                    )}
                  </>
                )}
                <p className="text-[10px] text-[color:var(--color-muted)]/70 mt-1">
                  {formatDate(n.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    aria-label="Marcar como lida"
                    className="w-5 h-5 rounded hover:bg-[color:var(--color-surface-3)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] flex items-center justify-center"
                  >
                    <Check size={11} />
                  </button>
                )}
                <button
                  onClick={() => remove(n.id)}
                  aria-label="Remover"
                  className="w-5 h-5 rounded hover:bg-[color:var(--color-surface-3)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] flex items-center justify-center"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
