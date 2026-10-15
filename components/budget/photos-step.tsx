"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { useBudgetDraft } from "@/stores/budget-store";
import { Upload, X, Camera } from "lucide-react";
import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function PhotosStep() {
  const { photos, addPhoto, removePhoto, customerName, customerPhone, setCustomer } = useBudgetDraft();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((f) => {
      const url = URL.createObjectURL(f);
      addPhoto(url);
    });
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <GlassCard className="p-6">
        <h2 className="text-xl font-semibold mb-1">Envie fotos do veículo</h2>
        <p className="text-sm text-text-secondary mb-4">
          Adicione ao menos 3 fotos: geral, área danificada de perto e ângulo lateral.
        </p>

        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-40 rounded-2xl border-2 border-dashed border-[color:var(--color-border)] hover:border-[color:var(--color-primary)]/50 bg-white/[0.02] hover:bg-[color:var(--color-primary)]/[0.05] transition-all flex flex-col items-center justify-center gap-2"
        >
          <Upload size={28} className="text-[color:var(--color-primary-soft)]" />
          <span className="text-sm font-medium">Arraste ou clique para enviar</span>
          <span className="text-xs text-text-secondary">PNG, JPG até 10MB</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          <AnimatePresence>
            {photos.map((url) => (
              <motion.div
                key={url}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative aspect-square rounded-2xl overflow-hidden group border border-[color:var(--color-border)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Foto do veículo" className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(url)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 backdrop-blur text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {photos.length === 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-text-secondary">
            <Camera size={14} />
            Nenhuma foto enviada ainda
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-6 h-fit">
        <h3 className="text-lg font-semibold mb-4">Seus dados</h3>
        <div className="flex flex-col gap-4">
          <Field label="Nome completo">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomer({ name: e.target.value })}
              placeholder="Ana Silva"
              className="input"
            />
          </Field>
          <Field label="WhatsApp">
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomer({ phone: e.target.value })}
              placeholder="(11) 98765-4321"
              className="input"
            />
          </Field>
        </div>

        <style>{`
          .input {
            width: 100%;
            height: 44px;
            padding: 0 14px;
            border-radius: 14px;
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--color-border);
            color: var(--color-text);
            font-size: 14px;
            transition: all 0.2s;
          }
          .input:focus {
            outline: none;
            border-color: var(--color-primary);
            box-shadow: 0 0 0 3px rgba(37,99,235,0.15);
          }
        `}</style>
      </GlassCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-wider text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
