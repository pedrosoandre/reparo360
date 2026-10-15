"use client";

import { useEffect, useState } from "react";

export interface FipeState {
  status: "idle" | "loading" | "found" | "absent" | "error";
  marketValue?: number;
  matched?: { brand: string; model: string; year: number; fuel: string };
  fipeCode?: string;
  reference?: string;
  yearApproximated?: boolean;
  reason?: string;
}

const IDLE: FipeState = { status: "idle" };

/**
 * Busca o valor FIPE do veículo. "absent" (não existe na tabela) é resultado
 * normal, não erro — o cálculo simplesmente cai na heurística de categoria/marca.
 */
export function useFipe(vehicle?: {
  brand?: string;
  model?: string;
  year?: number;
}): FipeState {
  const { brand, model, year } = vehicle ?? {};
  const [state, setState] = useState<FipeState>(IDLE);

  useEffect(() => {
    if (!brand || !model || !year) {
      setState(IDLE);
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });

    const params = new URLSearchParams({ brand, model, year: String(year) });

    fetch(`/api/fipe?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (controller.signal.aborted) return;

        if (data.found) {
          setState({
            status: "found",
            marketValue: data.marketValue,
            matched: data.matched,
            fipeCode: data.fipeCode,
            reference: data.reference,
            yearApproximated: data.yearApproximated,
          });
        } else if (res.ok) {
          setState({ status: "absent", reason: data.reason });
        } else {
          setState({ status: "error", reason: data.reason ?? "Falha ao consultar a FIPE." });
        }
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setState({ status: "error", reason: "Não foi possível falar com a API da FIPE." });
      });

    return () => controller.abort();
  }, [brand, model, year]);

  return state;
}
