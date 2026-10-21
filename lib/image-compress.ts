/**
 * Reduz fotos no navegador antes de guardar ou enviar.
 *
 * Foto de celular tem 3–5 MB: passava do limite de 2 MB e era descartada, e
 * duas delas em base64 já estouravam os 4,5 MB de corpo da Vercel na análise
 * por IA. Reencodar em JPEG com lado maior limitado deixa cada foto na casa de
 * centenas de KB, sem perder o que a oficina precisa ver.
 */

/** Lado maior das fotos guardadas no navegador. */
export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_JPEG_QUALITY = 0.82;

/** Versão menor mandada pra análise por IA (até 6 fotos num pedido). */
export const ANALYSIS_MAX_EDGE = 1024;
export const ANALYSIS_JPEG_QUALITY = 0.75;

/** Dimensões que cabem em `maxEdge` mantendo a proporção. Não amplia. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Reencoda em JPEG reduzido. Devolve null quando o navegador não consegue
 * abrir a imagem (ex.: HEIC no Chrome) — o caller decide o que fazer.
 */
export async function compressImage(
  blob: Blob,
  maxEdge = PHOTO_MAX_EDGE,
  quality = PHOTO_JPEG_QUALITY,
): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  // PNG com transparência viraria fundo preto no JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
}
