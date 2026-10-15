"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StoredDocument } from "@/types";
import { uid } from "@/lib/ids";

interface DocumentsState {
  documents: StoredDocument[];
  addDocument: (
    userId: string,
    input: Omit<StoredDocument, "id" | "userId" | "createdAt">,
  ) => StoredDocument;
  removeDocument: (id: string) => void;
  documentsFor: (userId: string) => StoredDocument[];
}

export const useDocumentsStore = create<DocumentsState>()(
  persist(
    (set, get) => ({
      documents: [],

      addDocument: (userId, input) => {
        const doc: StoredDocument = {
          ...input,
          id: uid("doc"),
          userId,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ documents: [doc, ...s.documents] }));
        return doc;
      },

      removeDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      documentsFor: (userId) => get().documents.filter((d) => d.userId === userId),
    }),
    {
      name: "reparo360:documents",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
