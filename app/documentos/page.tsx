"use client";

import { useMemo, useRef } from "react";
import { FileText, Upload, Trash2, Download } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { useCurrentUser } from "@/stores/auth-store";
import { useDocumentsStore } from "@/stores/documents-store";
import { formatDate } from "@/lib/utils";
import type { StoredDocument } from "@/types";
import { toast } from "@/stores/toast-store";
import { confirmDialog } from "@/stores/confirm-store";

const CATEGORY_LABELS: Record<StoredDocument["category"], string> = {
  crlv: "CRLV",
  seguro: "Seguro",
  cnh: "CNH",
  outro: "Outro",
};

const MAX_FILE_MB = 4;

function detectCategory(name: string): StoredDocument["category"] {
  const n = name.toLowerCase();
  if (n.includes("crlv") || n.includes("licenciamento")) return "crlv";
  if (n.includes("seguro") || n.includes("apolice") || n.includes("apólice")) return "seguro";
  if (n.includes("cnh") || n.includes("habilita")) return "cnh";
  return "outro";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentosPage() {
  const user = useCurrentUser();
  const allDocuments = useDocumentsStore((s) => s.documents);
  const documents = useMemo(
    () => (user ? allDocuments.filter((d) => d.userId === user.id) : []),
    [allDocuments, user],
  );
  const addDocument = useDocumentsStore((s) => s.addDocument);
  const removeDocument = useDocumentsStore((s) => s.removeDocument);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || !user) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast(`"${file.name}" tem mais de ${MAX_FILE_MB}MB. Arquivos maiores não cabem no navegador.`, "error");
        continue;
      }
      const data = await fileToDataUrl(file);
      addDocument(user.id, {
        name: file.name,
        category: detectCategory(file.name),
        mime: file.type || "application/octet-stream",
        data,
        size: file.size,
      });
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function download(doc: StoredDocument) {
    const link = document.createElement("a");
    link.href = doc.data;
    link.download = doc.name;
    link.click();
  }

  return (
    <DashboardShell>
      <div className="premium-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold">Meus documentos</h1>
            <p className="text-xs text-[color:var(--color-muted)]">
              CRLV, seguro, CNH — guardados só no seu navegador
            </p>
          </div>
          <label className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary)] px-3.5 py-2 text-xs font-semibold text-[color:var(--color-text)] hover:brightness-110 transition cursor-pointer">
            <Upload size={14} />
            Enviar
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
              accept="image/*,.pdf"
            />
          </label>
        </div>

        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sem documentos"
            description={`Arquivos até ${MAX_FILE_MB}MB. Ficam no localStorage — não sobem pra nenhum servidor.`}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-3"
              >
                <div className="w-10 h-10 rounded-xl bg-[color:var(--color-surface)] flex items-center justify-center text-[color:var(--color-muted)] shrink-0">
                  <FileText size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-[11px] text-[color:var(--color-muted)] flex items-center gap-2 mt-0.5">
                    <span className="px-1.5 py-0.5 rounded bg-[color:var(--color-surface-3)] text-[9px] uppercase tracking-wider">
                      {CATEGORY_LABELS[d.category]}
                    </span>
                    <span>{formatSize(d.size)}</span>
                    <span>· {formatDate(d.createdAt)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => download(d)}
                    aria-label="Baixar"
                    className="w-8 h-8 rounded-xl bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-3)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] flex items-center justify-center transition-colors"
                  >
                    <Download size={13} />
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirmDialog({
                        message: `Apagar "${d.name}"?`,
                        confirmLabel: "Apagar",
                        danger: true,
                      });
                      if (ok) removeDocument(d.id);
                    }}
                    aria-label="Remover"
                    className="w-8 h-8 rounded-xl bg-[color:var(--color-surface)] hover:bg-[color:var(--color-danger)]/15 text-[color:var(--color-muted)] hover:text-[color:var(--color-danger)] flex items-center justify-center transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
