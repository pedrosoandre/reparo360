import { putBlob, type BlobRef } from "./blob-store";

export const MAX_PHOTO_MB = 2;

export interface PhotoIntakeResult {
  /** Referências pra guardar no estado. O binário já está no IndexedDB. */
  refs: BlobRef[];
  /** Arquivos recusados, com o motivo — o caller decide como avisar. */
  rejected: { name: string; reason: string }[];
}

/**
 * Grava os arquivos no IndexedDB e devolve referências curtas.
 *
 * O binário NÃO entra mais no estado do zustand: data URL em localStorage
 * estourava a cota da origem com poucas fotos, e sem tratamento de erro.
 */
export async function filesToPhotos(
  files: FileList | null,
  slotsLeft: number,
): Promise<PhotoIntakeResult> {
  const result: PhotoIntakeResult = { refs: [], rejected: [] };
  if (!files) return result;

  const list = Array.from(files);
  const accepted = list.slice(0, Math.max(0, slotsLeft));

  for (const extra of list.slice(accepted.length)) {
    result.rejected.push({ name: extra.name, reason: "limite de fotos atingido" });
  }

  for (const file of accepted) {
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      result.rejected.push({ name: file.name, reason: `passa de ${MAX_PHOTO_MB}MB` });
      continue;
    }
    if (!file.type.startsWith("image/")) {
      result.rejected.push({ name: file.name, reason: "não é imagem" });
      continue;
    }
    try {
      result.refs.push(await putBlob(file));
    } catch {
      result.rejected.push({ name: file.name, reason: "falha ao gravar no navegador" });
    }
  }

  return result;
}
