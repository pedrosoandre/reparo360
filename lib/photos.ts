import { putBlob, getBlob, isInlineRef, type BlobRef } from "./blob-store";
import { compressImage, ANALYSIS_MAX_EDGE, ANALYSIS_JPEG_QUALITY } from "./image-compress";

/** Teto do que fica GUARDADO (depois de comprimir). */
export const MAX_PHOTO_MB = 2;
/** Teto do arquivo que o usuário escolhe — acima disso nem tenta abrir. */
export const MAX_INPUT_PHOTO_MB = 25;

/** Formatos que a análise por IA aceita, se a foto precisar ir sem reencodar. */
const PASSTHROUGH_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface PhotoIntakeResult {
  /** Referências pra guardar no estado. O binário já está no IndexedDB. */
  refs: BlobRef[];
  /** Arquivos recusados, com o motivo — o caller decide como avisar. */
  rejected: { name: string; reason: string }[];
}

/**
 * Comprime e grava os arquivos no IndexedDB, devolvendo referências curtas.
 *
 * O binário NÃO entra no estado do zustand: data URL em localStorage estourava
 * a cota da origem com poucas fotos, e sem tratamento de erro.
 */
export async function filesToPhotos(
  files: FileList | File[] | null,
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
    if (!file.type.startsWith("image/")) {
      result.rejected.push({ name: file.name, reason: "não é imagem" });
      continue;
    }
    if (file.size > MAX_INPUT_PHOTO_MB * 1024 * 1024) {
      result.rejected.push({ name: file.name, reason: `passa de ${MAX_INPUT_PHOTO_MB}MB` });
      continue;
    }
    const compressed = await compressImage(file);
    // Sem conseguir abrir (HEIC no Chrome), só guarda cru o que a IA e os
    // navegadores leem; o resto daria foto quebrada e erro 400 na análise.
    const toStore =
      compressed ??
      (PASSTHROUGH_TYPES.includes(file.type) ? file : null);
    if (!toStore) {
      result.rejected.push({ name: file.name, reason: "formato não suportado (use JPG ou PNG)" });
      continue;
    }
    if (toStore.size > MAX_PHOTO_MB * 1024 * 1024) {
      result.rejected.push({ name: file.name, reason: `passa de ${MAX_PHOTO_MB}MB` });
      continue;
    }
    try {
      result.refs.push(await putBlob(toStore));
    } catch {
      result.rejected.push({ name: file.name, reason: "falha ao gravar no navegador" });
    }
  }

  return result;
}

/**
 * Data URL reduzida pra mandar à análise por IA. Fotos antigas foram guardadas
 * sem compressão (até 2 MB); seis delas em base64 passavam dos 4,5 MB de corpo
 * que a Vercel aceita. Null se a foto sumiu ou não abre.
 */
export async function refToAnalysisDataUrl(ref: BlobRef): Promise<string | null> {
  const blob = isInlineRef(ref) ? await (await fetch(ref)).blob() : await getBlob(ref);
  if (!blob) return null;
  const small = (await compressImage(blob, ANALYSIS_MAX_EDGE, ANALYSIS_JPEG_QUALITY)) ?? blob;
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(small);
  });
}
