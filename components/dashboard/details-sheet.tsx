"use client";

import { useEffect, useMemo, useState } from "react";
import { X, UserRound, Car, TriangleAlert, History } from "lucide-react";
import { useCurrentUser, useAuthStore } from "@/stores/auth-store";
import { useVehiclesStore } from "@/stores/vehicles-store";
import { useBudgetsStore } from "@/stores/budgets-store";
import type { Vehicle } from "@/types";
import { formatBRL, formatDate } from "@/lib/utils";

export type DetailsSheetKind = "driver" | "vehicle" | "accident" | "history";

const TITLES: Record<DetailsSheetKind, string> = {
  driver: "Dados do motorista",
  vehicle: "Detalhes do carro",
  accident: "Detalhes do acidente",
  history: "Histórico de orçamentos",
};

const ICONS = { driver: UserRound, vehicle: Car, accident: TriangleAlert, history: History };

interface Props {
  kind: DetailsSheetKind;
  vehicle: Vehicle;
  onClose: () => void;
}

export function DetailsSheet({ kind, vehicle, onClose }: Props) {
  const Icon = ICONS[kind];

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[color:var(--color-surface)]/95 backdrop-blur-sm">
      <div className="w-full max-w-md premium-card border border-[color:var(--color-border)] p-5 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-3)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] flex items-center justify-center transition-colors"
        >
          <X size={15} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[color:var(--color-primary)]/10 border border-[color:var(--color-primary)]/20 flex items-center justify-center text-[color:var(--color-primary-glow)]">
            <Icon size={16} />
          </div>
          <h2 className="text-base font-semibold">{TITLES[kind]}</h2>
        </div>

        {kind === "driver" && <DriverForm />}
        {kind === "vehicle" && <VehicleForm vehicle={vehicle} />}
        {kind === "accident" && <AccidentForm vehicle={vehicle} />}
        {kind === "history" && <HistoryList />}
      </div>
    </div>
  );
}

function DriverForm() {
  const user = useCurrentUser();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    const r = updateProfile({ name, phone });
    setMsg(r.ok ? "Salvo." : r.error ?? "Erro.");
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Nome" value={name} onChange={setName} />
      <Field label="Celular" value={phone} onChange={setPhone} />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[color:var(--color-muted)]">{msg}</span>
        <button
          onClick={save}
          className="rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-xs font-semibold text-[color:var(--color-text)] hover:brightness-110 transition"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

function VehicleForm({ vehicle }: { vehicle: Vehicle }) {
  const update = useVehiclesStore((s) => s.updateVehicle);
  const [plate, setPlate] = useState(vehicle.plate ?? "");
  const [color, setColor] = useState(vehicle.color ?? "");
  const [mileage, setMileage] = useState(vehicle.mileage?.toString() ?? "");
  const [nickname, setNickname] = useState(vehicle.nickname ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    update(vehicle.id, {
      plate: plate.trim() || undefined,
      color: color.trim() || undefined,
      mileage: mileage ? Number(mileage) : undefined,
      nickname: nickname.trim() || undefined,
    });
    setMsg("Salvo.");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Placa" value={plate} onChange={setPlate} placeholder="Ex.: ABC1D23" />
        <Field label="Cor" value={color} onChange={setColor} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Quilometragem"
          value={mileage}
          onChange={setMileage}
          type="number"
          placeholder="Ex.: 42000"
        />
        <Field label="Apelido" value={nickname} onChange={setNickname} placeholder="Ex.: Vermelhinho" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[color:var(--color-muted)]">{msg}</span>
        <button
          onClick={save}
          className="rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-xs font-semibold text-[color:var(--color-text)] hover:brightness-110 transition"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

function AccidentForm({ vehicle }: { vehicle: Vehicle }) {
  // O local do acidente hoje mora em cada dano (DamageRecord.location).
  // Aqui a gente coleta um local "global" e propaga pra danos futuros via storage local.
  const key = `reparo360:accident:${vehicle.id}`;
  const [location, setLocation] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem(`${key}:location`) ?? "",
  );
  const [date, setDate] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem(`${key}:date`) ?? "",
  );
  const [description, setDescription] = useState(() =>
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(`${key}:description`) ?? "",
  );
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(`${key}:location`, location);
    window.localStorage.setItem(`${key}:date`, date);
    window.localStorage.setItem(`${key}:description`, description);
    setMsg("Salvo.");
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Local" value={location} onChange={setLocation} placeholder="Ex.: Marginal Pinheiros" />
      <Field label="Data" type="date" value={date} onChange={setDate} />
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
          Descrição
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] px-3 py-2 text-body text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-primary)]/50 transition-colors resize-none"
        />
      </label>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[color:var(--color-muted)]">{msg}</span>
        <button
          onClick={save}
          className="rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-xs font-semibold text-[color:var(--color-text)] hover:brightness-110 transition"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

function HistoryList() {
  const user = useCurrentUser();
  const allBudgets = useBudgetsStore((s) => s.budgets);
  const budgets = useMemo(
    () => (user ? allBudgets.filter((b) => b.userId === user.id) : []),
    [allBudgets, user],
  );
  if (budgets.length === 0) {
    return (
      <p className="text-xs text-[color:var(--color-muted)]">
        Nenhum orçamento no histórico ainda.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {budgets.map((b) => (
        <a
          key={b.id}
          href={`/orcamentos/${b.id}`}
          className="rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-3 hover:border-[color:var(--color-border-strong)] transition-colors"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium truncate">
              {b.vehicleSnapshot.brand} {b.vehicleSnapshot.model}
            </p>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[color:var(--color-surface-3)]">
              {b.status}
            </span>
          </div>
          <p className="text-[11px] text-[color:var(--color-muted)] mt-1 flex items-center gap-2">
            <span className="font-mono">{b.code}</span>
            <span>· {formatDate(b.createdAt)}</span>
            <span>· {formatBRL(b.total)}</span>
          </p>
        </a>
      ))}
    </div>
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
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full h-10 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] px-3 text-body text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-primary)]/50 transition-colors"
      />
    </label>
  );
}
