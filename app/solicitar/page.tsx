"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Send, MessageCircle } from "lucide-react";
import { Stepper } from "@/components/budget/stepper";
import { VehicleStep } from "@/components/budget/vehicle-step";
import { PartsStep } from "@/components/budget/parts-step";
import { DamageStep } from "@/components/budget/damage-step";
import { PhotosStep } from "@/components/budget/photos-step";
import { SummaryStep } from "@/components/budget/summary-step";
import { PremiumButton } from "@/components/ui/premium-button";
import { SendWorkshopModal } from "@/components/budget/send-workshop-modal";
import { useBudgetDraft } from "@/stores/budget-store";
import { useState } from "react";
import { useCurrentUser } from "@/stores/auth-store";
import { useVehiclesStore } from "@/stores/vehicles-store";
import { useDamagesStore } from "@/stores/damages-store";
import { useBudgetsStore } from "@/stores/budgets-store";
import { useNotificationsStore } from "@/stores/notifications-store";
import { findVehicle } from "@/lib/vehicles";
import type { Budget } from "@/types";

const STEPS = [VehicleStep, PartsStep, DamageStep, PhotosStep, SummaryStep];

export default function SolicitarPage() {
  const { step, next, back, vehicle, items, photos, customerName, customerPhone, notes, reset } =
    useBudgetDraft();
  const [savedBudget, setSavedBudget] = useState<Budget | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const user = useCurrentUser();
  const addVehicle = useVehiclesStore((s) => s.addVehicle);
  const vehiclesAll = useVehiclesStore((s) => s.vehicles);
  const addDamage = useDamagesStore((s) => s.addDamage);
  const createFromDashboard = useBudgetsStore((s) => s.createFromDashboard);
  const recordOficinaContact = useBudgetsStore((s) => s.recordOficinaContact);
  const pushNotification = useNotificationsStore((s) => s.push);

  function handleSend() {
    if (!user || !vehicle.brand || !vehicle.model || !vehicle.year) return;
    const catalog = findVehicle(vehicle.brand, vehicle.model);
    if (!catalog) return;
    const existing = vehiclesAll.find(
      (v) =>
        v.userId === user.id &&
        v.brand === vehicle.brand &&
        v.model === vehicle.model &&
        v.year === vehicle.year,
    );
    const stored =
      existing ??
      addVehicle(user.id, {
        brand: vehicle.brand!,
        model: vehicle.model!,
        year: vehicle.year!,
        glb: catalog.glb,
        category: catalog.category,
      });
    const damageRecords = items.map((it) =>
      addDamage(stored.id, {
        part: it.part,
        damages: it.damages,
        photos,
        notes,
      }),
    );
    const budget = createFromDashboard({
      userId: user.id,
      vehicle: stored,
      damages: damageRecords,
      photos,
      customerName: customerName || user.name,
      customerPhone: customerPhone || user.phone,
      notes,
      source: "wizard",
    });
    pushNotification(user.id, {
      title: `Orçamento ${budget.code} criado`,
      body: `${budget.items.length} peça(s) — pronto pra enviar pra oficinas`,
      href: `/orcamentos/${budget.id}`,
    });
    setSavedBudget(budget);
    // Abre imediatamente o modal de escolher oficina — enquanto o wizard
    // não fizer isso, o botão "Enviar" era mentira: só salvava.
    setSendOpen(true);
  }

  const canProceed =
    (step === 0 && !!vehicle.brand && !!vehicle.model && !!vehicle.year) ||
    (step === 1 && items.length > 0) ||
    (step === 2 && items.every((i) => i.damages.length > 0)) ||
    step === 3 ||
    step === 4;

  const StepComp = STEPS[step];

  if (savedBudget) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center px-6 grid-bg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-12 max-w-md text-center"
          >
            <div className="w-16 h-16 rounded-full bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] flex items-center justify-center mx-auto mb-4 text-3xl">
              ✓
            </div>
            <h2 className="text-2xl font-semibold">Orçamento pronto!</h2>
            <p className="text-text-secondary mt-2">
              Código{" "}
              <span className="font-mono font-semibold text-white">{savedBudget.code}</span>
              . Escolha as oficinas que vão receber, ou acompanhe no dashboard.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <PremiumButton
                className="w-full"
                onClick={() => setSendOpen(true)}
              >
                <MessageCircle size={16} /> Enviar para oficina
              </PremiumButton>
              <Link href={`/orcamentos/${savedBudget.id}`}>
                <button className="w-full h-11 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-sm font-medium transition">
                  Ver detalhes do orçamento
                </button>
              </Link>
              <button
                onClick={() => {
                  reset();
                  setSavedBudget(null);
                }}
                className="text-sm text-text-secondary hover:text-text mt-1"
              >
                Criar novo orçamento
              </button>
            </div>
          </motion.div>
        </div>
        {sendOpen && (
          <SendWorkshopModal
            budget={savedBudget}
            initialCity={savedBudget.location}
            onOficinaContacted={(o) =>
              recordOficinaContact(savedBudget.id, {
                nome: o.nome,
                cidade: o.cidade,
                waId: o.waId,
              })
            }
            onClose={() => setSendOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen grid-bg pb-24">
      <header className="sticky top-0 z-30 backdrop-blur-xl border-b border-[color:var(--color-border)] bg-bg/70">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[color:var(--color-primary)] to-[color:var(--color-primary-soft)] flex items-center justify-center text-white font-bold">
              R
            </div>
            <span className="font-semibold tracking-tight">Reparo360</span>
          </Link>
          <Stepper current={step} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
          >
            <StepComp />
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between">
          <PremiumButton variant="ghost" onClick={back} disabled={step === 0}>
            <ArrowLeft size={16} />
            Voltar
          </PremiumButton>
          {step < STEPS.length - 1 ? (
            <PremiumButton onClick={next} disabled={!canProceed}>
              Continuar
              <ArrowRight size={16} />
            </PremiumButton>
          ) : (
            <PremiumButton onClick={handleSend}>
              Enviar para oficina
              <Send size={16} />
            </PremiumButton>
          )}
        </div>
      </main>
    </div>
  );
}
