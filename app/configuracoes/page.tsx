"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, AlertCircle, Check } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { useAuthStore, useCurrentUser } from "@/stores/auth-store";
import { useVehiclesStore } from "@/stores/vehicles-store";
import { useDamagesStore } from "@/stores/damages-store";
import { useBudgetsStore } from "@/stores/budgets-store";
import { useDocumentsStore } from "@/stores/documents-store";
import { confirmDialog } from "@/stores/confirm-store";

export default function ConfiguracoesPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const changePassword = useAuthStore((s) => s.changePassword);
  const wipeAll = useAuthStore((s) => s.wipeAll);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const r = updateProfile({ name, email, phone, city });
    setProfileMsg(r.ok ? { ok: true, msg: "Perfil atualizado." } : { ok: false, msg: r.error ?? "Erro." });
  }

  function savePassword(e: React.FormEvent) {
    e.preventDefault();
    const r = changePassword(currentPassword, newPassword);
    if (r.ok) {
      setPwdMsg({ ok: true, msg: "Senha alterada." });
      setCurrentPassword("");
      setNewPassword("");
    } else {
      setPwdMsg({ ok: false, msg: r.error ?? "Erro." });
    }
  }

  function exportData() {
    const state = {
      exportedAt: new Date().toISOString(),
      auth: { currentUserId: useAuthStore.getState().currentUserId, users: useAuthStore.getState().users },
      vehicles: useVehiclesStore.getState().vehicles,
      damages: useDamagesStore.getState().damages,
      budgets: useBudgetsStore.getState().budgets,
      documents: useDocumentsStore.getState().documents,
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reparo360-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleWipe() {
    const ok = await confirmDialog({
      title: "Apagar todos os dados",
      message:
        "Isso apaga TODOS os dados do app deste navegador: veículos, danos, orçamentos e documentos.",
      confirmLabel: "Apagar tudo",
      danger: true,
    });
    if (!ok) return;

    const sure = await confirmDialog({
      title: "Última confirmação",
      message: "Não tem como desfazer. Apagar tudo mesmo?",
      confirmLabel: "Sim, apagar",
      danger: true,
    });
    if (!sure) return;
    wipeAll();
    router.push("/dashboard");
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4 max-w-2xl">
        <div className="premium-card p-4 sm:p-5">
          <h2 className="font-semibold mb-1">Perfil</h2>
          <p className="text-xs text-[color:var(--color-muted)] mb-4">
            Como você aparece nos orçamentos que envia.
          </p>
          <form onSubmit={saveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome" value={name} onChange={setName} />
            <Field label="E-mail" type="email" value={email} onChange={setEmail} />
            <Field label="Celular" value={phone} onChange={setPhone} />
            <Field
              label="Cidade"
              value={city}
              onChange={setCity}
              placeholder="Ex.: Porto Alegre"
            />
            <div className="sm:col-span-2 flex items-center justify-between gap-3">
              {profileMsg ? (
                <Feedback ok={profileMsg.ok} msg={profileMsg.msg} />
              ) : (
                <span />
              )}
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 transition"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>

        <div className="premium-card p-4 sm:p-5">
          <h2 className="font-semibold mb-1">Senha</h2>
          <p className="text-xs text-[color:var(--color-muted)] mb-4">
            Alterar senha da conta.
          </p>
          <form onSubmit={savePassword} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Senha atual"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
            <Field
              label="Nova senha"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
            />
            <div className="sm:col-span-2 flex items-center justify-between gap-3">
              {pwdMsg ? <Feedback ok={pwdMsg.ok} msg={pwdMsg.msg} /> : <span />}
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 transition"
              >
                Alterar
              </button>
            </div>
          </form>
        </div>

        <div className="premium-card p-4 sm:p-5">
          <h2 className="font-semibold mb-1">Dados do app</h2>
          <p className="text-xs text-[color:var(--color-muted)] mb-4">
            Tudo é guardado só no seu navegador. Faça backup antes de trocar de dispositivo.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportData}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-3.5 py-2 text-xs font-medium text-white transition"
            >
              <Download size={13} />
              Exportar backup (JSON)
            </button>
            <button
              onClick={handleWipe}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-danger)]/10 hover:bg-[color:var(--color-danger)]/20 border border-[color:var(--color-danger)]/30 px-3.5 py-2 text-xs font-medium text-[color:var(--color-danger)] transition"
            >
              <Trash2 size={13} />
              Apagar tudo
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 text-body text-white placeholder:text-[color:var(--color-muted)]/60 outline-none focus:border-[color:var(--color-primary)]/50 transition-colors"
      />
    </label>
  );
}

function Feedback({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${
        ok ? "text-[color:var(--color-success)]" : "text-[color:var(--color-danger)]"
      }`}
    >
      {ok ? <Check size={13} /> : <AlertCircle size={13} />}
      {msg}
    </span>
  );
}
