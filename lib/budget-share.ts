/**
 * Utilitários pra montar mensagem de WhatsApp e link público de um orçamento.
 * O link público codifica o orçamento em base64url na URL (client-side, sem
 * backend) — a oficina abre no browser, vê o orçamento read-only e clica
 * "Aceitar/Recusar" (por enquanto só notifica o cliente via toast; quando
 * tiver backend, vira POST real).
 *
 * SEGURANÇA: como o app não tem backend, não existe segredo secreto — a chave
 * usada em `signPayload` viaja no bundle. O objetivo do parâmetro `&s=` é
 * detectar edição CASUAL do URL (colega abre devtools, troca `grandTotal`, envia
 * pra oficina). Atacante determinado recomputa a assinatura. Quando existir
 * backend, o link vira `/o/<code>` opaco resolvido no servidor.
 */
import type { Budget } from "@/types";
import { formatBRL } from "@/lib/utils";
import { DAMAGE_LABELS } from "@/lib/car-parts";

/** Encoda um payload arbitrário em base64url (safe pra URL). */
export function toBase64Url(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = typeof window === "undefined"
    ? Buffer.from(json, "utf-8").toString("base64")
    : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url<T = unknown>(s: string): T {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const json = typeof window === "undefined"
    ? Buffer.from(padded, "base64").toString("utf-8")
    : decodeURIComponent(escape(atob(padded)));
  return JSON.parse(json) as T;
}

/**
 * Assinatura sync de integridade (não crypto). djb2 keyed com o salt fixo do
 * app. Serve pra detectar edição acidental do URL, não pra impedir ataque.
 * O salt vive no bundle — quem inspecionar o JS recomputa.
 */
const INTEGRITY_SALT = "r360.v1.integrity";

export function signPayload(base64Payload: string): string {
  let h = 5381;
  const s = `${INTEGRITY_SALT}|${base64Payload}`;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export function verifyPayload(base64Payload: string, signature: string): boolean {
  return signPayload(base64Payload) === signature;
}

export interface ShareableBudget {
  code: string;
  vehicle: string;
  vehicleYear: number;
  customerName: string;
  customerPhone?: string;
  items: Array<{ label: string; damages: string[]; cost: number }>;
  extras: Array<{ label: string; price: number }>;
  totalRepair: number;
  totalExtras: number;
  grandTotal: number;
  createdAt: string;
}

export function toShareable(budget: Budget): ShareableBudget {
  const items = budget.items.map((i) => ({
    label: i.partLabel,
    damages: i.damages.map((d) => DAMAGE_LABELS[d] ?? d),
    cost: i.estimatedCost,
  }));
  const extras = (budget.extras ?? []).map((e) => ({
    label: e.label,
    price: e.price,
  }));
  const totalExtras = extras.reduce((a, b) => a + b.price, 0);
  return {
    code: budget.code,
    vehicle: `${budget.vehicleSnapshot.brand} ${budget.vehicleSnapshot.model}`,
    vehicleYear: budget.vehicleSnapshot.year,
    customerName: budget.customerName,
    customerPhone: budget.customerPhone,
    items,
    extras,
    totalRepair: budget.total,
    totalExtras,
    grandTotal: budget.total + totalExtras,
    createdAt: budget.createdAt,
  };
}

/** Monta o corpo do WhatsApp em texto puro (sem markdown pesado). */
export function whatsappMessage(
  budget: Budget,
  oficinaNome: string,
  publicUrl: string,
): string {
  const s = toShareable(budget);
  const linhas: string[] = [];
  linhas.push(`Olá, ${oficinaNome}!`);
  linhas.push("");
  linhas.push(
    `Gostaria de um orçamento pra reparar o meu ${s.vehicle} ${s.vehicleYear}.`,
  );
  linhas.push(`Código do pedido: *${s.code}*`);
  linhas.push("");
  linhas.push(`*Peças com dano (${s.items.length}):*`);
  s.items.forEach((it, i) => {
    linhas.push(
      `${i + 1}. ${it.label} — ${it.damages.join(", ")} · ~${formatBRL(it.cost)}`,
    );
  });
  if (s.extras.length) {
    linhas.push("");
    linhas.push(`*Serviços extras solicitados:*`);
    s.extras.forEach((e) => linhas.push(`• ${e.label} — ${formatBRL(e.price)}`));
  }
  linhas.push("");
  linhas.push(`*Estimativa total: ${formatBRL(s.grandTotal)}*`);
  linhas.push(`(estimativa gerada pelo Reparo360, sujeita ao seu orçamento final)`);
  linhas.push("");
  linhas.push(`Detalhes completos + fotos:`);
  linhas.push(publicUrl);
  linhas.push("");
  linhas.push(`Aguardo o seu retorno com o orçamento oficial. Obrigado!`);
  if (s.customerName) linhas.push(`— ${s.customerName}`);
  return linhas.join("\n");
}

export function whatsappLink(waId: string, message: string): string {
  return `https://wa.me/${waId}?text=${encodeURIComponent(message)}`;
}

export function publicBudgetUrl(budget: Budget, origin: string): string {
  const payload = toBase64Url(toShareable(budget));
  const sig = signPayload(payload);
  return `${origin}/o/${budget.code}?d=${payload}&s=${sig}`;
}

/**
 * Lê o payload do link público validando integridade. Retorna null se a
 * assinatura não bater (URL editado) ou o base64 estiver corrompido.
 *
 * Links antigos (sem `&s=`) continuam abrindo — decisão pragmática pra não
 * quebrar orçamentos já enviados por WhatsApp; a checagem é sinalizada em
 * `verified: false` pra a UI mostrar aviso.
 */
export interface PublicBudgetRead {
  budget: ShareableBudget;
  verified: boolean;
}

export function readPublicBudget(
  d: string | null,
  s: string | null,
): PublicBudgetRead | null {
  if (!d) return null;
  let budget: ShareableBudget;
  try {
    budget = fromBase64Url<ShareableBudget>(d);
  } catch {
    return null;
  }
  const verified = s !== null && verifyPayload(d, s);
  // Se veio assinatura e ela não bate, é sabotagem intencional: recuse.
  if (s !== null && !verified) return null;
  return { budget, verified };
}
