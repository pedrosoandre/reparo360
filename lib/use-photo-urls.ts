"use client";

import { useEffect, useState } from "react";
import { refToObjectUrl, isInlineRef, type BlobRef } from "./blob-store";

/**
 * Resolve referências de foto em URLs exibíveis. O array de saída é alinhado
 * com o de entrada; `null` significa "ainda carregando" ou "binário sumiu".
 *
 * Data URLs legadas resolvem de forma síncrona, então dado antigo não pisca.
 */
export function usePhotoUrls(refs: BlobRef[]): (string | null)[] {
  const key = refs.join("|");
  const [urls, setUrls] = useState<(string | null)[]>(() =>
    refs.map((r) => (isInlineRef(r) ? r : null)),
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(refs.map((r) => refToObjectUrl(r).catch(() => null))).then((resolved) => {
      if (!cancelled) setUrls(resolved);
    });
    return () => {
      cancelled = true;
    };
    // `key` é a identidade estável do conteúdo de `refs` — depender do array
    // em si dispararia o efeito a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}

export function usePhotoUrl(ref?: BlobRef | null): string | null {
  const urls = usePhotoUrls(ref ? [ref] : []);
  return urls[0] ?? null;
}
