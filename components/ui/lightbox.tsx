"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { usePhotoUrls } from "@/lib/use-photo-urls";

interface LightboxProps {
  /** Referências de foto (IndexedDB ou data URL legada), não URLs prontas. */
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function Lightbox({ photos, initialIndex = 0, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const urls = usePhotoUrls(photos);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, photos.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, photos.length]);

  if (photos.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Fechar"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-[color:var(--color-text)] flex items-center justify-center transition-colors"
      >
        <X size={18} />
      </button>

      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => Math.max(i - 1, 0));
            }}
            disabled={index === 0}
            aria-label="Anterior"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-[color:var(--color-text)] flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => Math.min(i + 1, photos.length - 1));
            }}
            disabled={index === photos.length - 1}
            aria-label="Próxima"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-[color:var(--color-text)] flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {urls[index] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urls[index]!}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
        />
      ) : (
        <p className="text-sm text-[color:var(--color-muted)]">Carregando foto…</p>
      )}

      {photos.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/[0.08] text-xs text-[color:var(--color-text)]">
          {index + 1} / {photos.length}
        </div>
      )}
    </div>
  );
}
