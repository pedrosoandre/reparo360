"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { useBudgetDraft } from "@/stores/budget-store";
import { Upload, X, Camera } from "lucide-react";
import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { filesToPhotos } from "@/lib/photos";
import { deleteBlob } from "@/lib/blob-store";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import { toast } from "@/stores/toast-store";

const MAX_PHOTOS = 10;

export function PhotosStep() {
  const { photos, addPhoto, removePhoto, customerName, customerPhone, setCustomer } = useBudgetDraft();
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = usePhotoUrls(photos);

  // Mesmo caminho do dashboard (comprime e grava no IndexedDB). Antes eram
  // blob: URLs, que somem no reload e nunca apareciam no orçamento salvo.
  async function handleFiles(files: FileList | null) {
    const next = await filesToPhotos(files, MAX_PHOTOS - photos.length);
    next.refs.forEach(addPhoto);
    if (next.rejected.length) {
      toast(next.rejected.map((r) => `"${r.name}": ${r.reason}`).join(" · "), "error");
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove(ref: string) {
    removePhoto(ref);
    deleteBlob(ref).catch(() => {});
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <GlassCard className="p-6">
        <h2 className="text-title font-semibold mb-1">Envie fotos do veículo</h2>
        <p className="text-body text-text-secondary mb-4">
          Adicione ao menos 3 fotos: geral, área danificada de perto e ângulo lateral.
        </p>

        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-40 rounded-2xl border-2 border-dashed border-[color:var(--color-border)] hover:border-[color:var(--color-primary)]/50 bg-[color:var(--color-surface)] hover:bg-[color:var(--color-primary)]/[0.05] transition-all flex flex-col items-center justify-center gap-2"
        >
          <Upload size={28} className="text-[color:var(--color-primary-soft)]" />
          <span className="text-body font-medium">Arraste ou clique para enviar</span>
          <span className="text-label text-text-secondary">
            JPG ou PNG, até {MAX_PHOTOS} fotos. Fotos grandes são reduzidas.
          </span>
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
            {photos.map((ref, i) => (
              <motion.div
                key={ref}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative aspect-square rounded-2xl overflow-hidden group border border-[color:var(--color-border)]"
              >
                {urls[i] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[i]!} alt="Foto do veículo" className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => handleRemove(ref)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[color:var(--color-surface)]/95 backdrop-blur text-[color:var(--color-text)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {photos.length === 0 && (
          <div className="mt-4 flex items-center gap-2 text-label text-text-secondary">
            <Camera size={14} />
            Nenhuma foto enviada ainda
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-6 h-fit">
        <h3 className="text-title font-semibold mb-4">Seus dados</h3>
        <div className="flex flex-col gap-4">
          <Field label="Nome completo">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomer({ name: e.target.value })}
              placeholder="Ex.: Ana Silva"
              className="input"
            />
          </Field>
          <Field label="WhatsApp">
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomer({ phone: e.target.value })}
              placeholder="Ex.: (11) 98765-4321"
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
      <span className="text-meta uppercase tracking-[0.08em] text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
