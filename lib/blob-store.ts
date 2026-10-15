"use client";

/**
 * Armazenamento de binários (fotos, documentos) no IndexedDB.
 *
 * Antes isso ia como data URL dentro do estado do zustand, que persiste em
 * localStorage. Medido: a cota da origem comporta ~9 fotos de 2MB no total,
 * enquanto a UI promete 6 por dano num carro de 22 peças — e não havia
 * tratamento nenhum de estouro, então a foto sumia (ou explodia) em silêncio.
 *
 * Agora o estado guarda só uma referência curta e o binário mora aqui.
 */

const DB_NAME = "reparo360";
const DB_VERSION = 1;
const STORE = "blobs";

/** Referência guardada no estado: "idb:<uuid>", ou uma data URL legada. */
export type BlobRef = string;

const IDB_PREFIX = "idb:";

/** Dados antigos já persistidos como data URL continuam funcionando. */
export function isInlineRef(ref: BlobRef): boolean {
  return ref.startsWith("data:");
}

export function isStoredRef(ref: BlobRef): boolean {
  return ref.startsWith(IDB_PREFIX);
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB indisponível neste ambiente."));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir o IndexedDB."));
  });

  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Operação falhou no IndexedDB."));
      }),
  );
}

function newId(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${IDB_PREFIX}${uuid}`;
}

export async function putBlob(blob: Blob): Promise<BlobRef> {
  const ref = newId();
  await tx("readwrite", (s) => s.put(blob, ref));
  return ref;
}

export async function getBlob(ref: BlobRef): Promise<Blob | null> {
  if (!isStoredRef(ref)) return null;
  const found = await tx<Blob | undefined>("readonly", (s) => s.get(ref));
  return found ?? null;
}

export async function deleteBlob(ref: BlobRef): Promise<void> {
  if (!isStoredRef(ref)) return;
  releaseUrl(ref);
  await tx("readwrite", (s) => s.delete(ref));
}

/**
 * Object URLs são cacheados por referência: recriar a cada render vazaria uma
 * URL por render. São liberados em deleteBlob e em releaseAllUrls.
 */
const urlCache = new Map<BlobRef, string>();

export async function refToObjectUrl(ref: BlobRef): Promise<string | null> {
  if (isInlineRef(ref)) return ref;

  const cached = urlCache.get(ref);
  if (cached) return cached;

  const blob = await getBlob(ref);
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  urlCache.set(ref, url);
  return url;
}

function releaseUrl(ref: BlobRef) {
  const url = urlCache.get(ref);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(ref);
  }
}

export function releaseAllUrls() {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}

/** A API de análise por IA precisa do base64, não de um object URL. */
export async function refToDataUrl(ref: BlobRef): Promise<string | null> {
  if (isInlineRef(ref)) return ref;

  const blob = await getBlob(ref);
  if (!blob) return null;

  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Remove binários que nenhum registro referencia mais. Chame com o conjunto
 * COMPLETO de referências vivas — passar um conjunto parcial apaga dado bom.
 *
 * Um conjunto vazio quase sempre é bug do caller (mapeou de estado ainda não
 * carregado). Bloqueamos com throw — se o intent for mesmo apagar tudo, use
 * `{ allowWipe: true }`.
 */
export async function sweepOrphans(
  keep: Iterable<BlobRef>,
  opts: { allowWipe?: boolean } = {},
): Promise<number> {
  const keepSet = new Set(keep);
  if (keepSet.size === 0 && !opts.allowWipe) {
    throw new Error(
      "sweepOrphans recebeu conjunto vazio. Isso apagaria todos os blobs. Passe { allowWipe: true } se for intencional.",
    );
  }
  const all = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());

  let removed = 0;
  for (const key of all) {
    const ref = String(key);
    if (!keepSet.has(ref)) {
      await deleteBlob(ref);
      removed++;
    }
  }
  return removed;
}

export async function storageUsage(): Promise<{ count: number; bytes: number }> {
  const blobs = await tx<Blob[]>("readonly", (s) => s.getAll());
  return {
    count: blobs.length,
    bytes: blobs.reduce((sum, b) => sum + b.size, 0),
  };
}
