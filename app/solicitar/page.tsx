"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Send, MessageCircle, Check } from "lucide-react";
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
            {/* Era um "✓" de texto: o traço e o peso vinham da fonte, então
                não casava com nenhum outro ícone da tela. Lucide, como o resto
                do app. */}
            <div className="w-16 h-16 rounded-full bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] flex items-center justify-center mx-auto mb-4">
              <Check size={32} strokeWidth={2.5} />
            </div>
            {/* Único lugar onde `metric` não é número: nesta tela de sucesso a
                frase É o maior elemento, e abrir um sexto papel para uma
                ocorrência não se paga. */}
            <h2 className="text-metric font-semibold">Orçamento pronto!</h2>
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
                <button className="w-full h-11 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-label font-medium transition">
                  Ver detalhes do orçamento
                </button>
              </Link>
              <button
                onClick={() => {
                  reset();
                  setSavedBudget(null);
                }}
                className="text-body text-text-secondary hover:text-text mt-1"
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
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[color:var(--color-primary)] to-[color:var(--color-primary-soft)] flex items-center justify-center text-white font-bold shrink-0">
              R
            </div>
            {/* No celular o nome sai e fica só a marca: o logo ocupava 146px
                dos 375 e empurrava o stepper 91px para fora da tela. Dentro do
                wizard o nome é redundante — você sabe onde está. */}
            <span className="hidden sm:inline font-semibold tracking-tight">Reparo360</span>
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

        {/* Celular: barra fixa no rodapé (o "Continuar" ficava abaixo da
            primeira tela, depois do formulário inteiro). Do lg pra cima volta
            a ser a linha de sempre, logo abaixo do passo. O contêiner da
            página já reserva o espaço com pb-24. */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-white/[0.08] bg-[#0F1116] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_30px_-12px_rgba(0,0,0,0.6)] lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <PremiumButton variant="ghost" onClick={back} disabled={step === 0}>
            <ArrowLeft size={16} />
            Voltar
          </PremiumButton>
          {step < STEPS.length - 1 ? (
            <PremiumButton className="flex-1 lg:flex-none" onClick={next} disabled={!canProceed}>
              Continuar
              <ArrowRight size={16} />
            </PremiumButton>
          ) : (
            <PremiumButton className="flex-1 lg:flex-none" onClick={handleSend}>
              Enviar para oficina
              <Send size={16} />
            </PremiumButton>
          )}
        </div>
      </main>
    </div>
  );
}
