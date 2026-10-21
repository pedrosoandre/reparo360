import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PART_LABELS, DAMAGE_LABELS } from "@/lib/car-parts";
import { createRateLimiter } from "@/lib/rate-limit";
import type { CarPart, DamageType } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const CAR_PARTS = Object.keys(PART_LABELS) as [CarPart, ...CarPart[]];
const DAMAGE_TYPES = Object.keys(DAMAGE_LABELS) as [DamageType, ...DamageType[]];

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const MAX_PHOTOS = 6;
/** Abaixo dos 4,5 MB da Vercel, pra responder em JSON em vez do HTML dela. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

// Cada análise custa dinheiro e a rota é pública: freio por IP e um teto por
// instância (ver lib/rate-limit.ts sobre o que isto cobre e o que não cobre).
const perIp = createRateLimiter({ limit: 8, windowMs: 10 * 60_000 });
const perInstance = createRateLimiter({ limit: 60, windowMs: 10 * 60_000 });

const UNAVAILABLE =
  "A análise por IA está indisponível no momento. Você pode marcar a peça e o tipo de dano manualmente.";

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "desconhecido"
  );
}

/** Navegador sempre manda Origin num POST; de outro site, recusa. */
function isCrossOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(req.url).host;
  } catch {
    return true;
  }
}

function tooManyRequests(retryAfterSec: number) {
  return NextResponse.json(
    {
      error: "rate_limited",
      message: "Muitas análises seguidas. Espere alguns minutos e tente de novo.",
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

/** Structured outputs garante que a resposta valida contra este schema. */
const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    detections: {
      type: "array",
      description: "Uma entrada por peça danificada. Vazio se nada for identificável.",
      items: {
        type: "object",
        properties: {
          part: { type: "string", enum: CAR_PARTS, description: "Peça danificada" },
          damages: {
            type: "array",
            items: { type: "string", enum: DAMAGE_TYPES },
            description: "Tipos de dano visíveis nesta peça",
          },
          confidence: { type: "number", description: "Confiança de 0 a 100" },
          rationale: {
            type: "string",
            description: "O que na foto sustenta essa conclusão, em uma frase",
          },
        },
        required: ["part", "damages", "confidence", "rationale"],
        additionalProperties: false,
      },
    },
    unusable: {
      type: "array",
      items: { type: "string" },
      description:
        "Motivos pelos quais alguma foto não pôde ser avaliada (desfoque, enquadramento, escuro). Vazio se todas serviram.",
    },
    notes: {
      type: "string",
      description: "Observação curta para a oficina, ou string vazia se não houver.",
    },
  },
  required: ["detections", "unusable", "notes"],
  additionalProperties: false,
} as const;

interface AnalysisOutput {
  detections: { part: CarPart; damages: DamageType[]; confidence: number; rationale: string }[];
  unusable: string[];
  notes: string;
}

const SYSTEM = `Você avalia fotos de danos em veículos para um orçamento de funilaria e pintura no Brasil.

Sua tarefa é identificar, a partir das fotos, QUAIS peças estão danificadas e QUE TIPO de dano cada uma tem. Você não estima preço — isso é feito depois por uma tabela.

Vocabulário fechado. Use exatamente estes identificadores:

PEÇAS
${CAR_PARTS.map((p) => `- ${p}: ${PART_LABELS[p]}`).join("\n")}

TIPOS DE DANO
${DAMAGE_TYPES.map((d) => `- ${d}: ${DAMAGE_LABELS[d]}`).join("\n")}

Critérios:
- Relate apenas dano que você consegue ver. Não infira dano em peças fora do enquadramento nem deduza dano interno a partir de dano externo.
- Esquerda e direita são do ponto de vista do motorista sentado no carro, não de quem olha a foto.
- Distinga arranhão leve (só o verniz, não pega a cor) de arranhão profundo (chega na cor ou no metal).
- Distinga amassado leve (funilaria sem repintura) de amassado médio (exige massa e repintura).
- Use "break" quando a peça está trincada, quebrada ou faltando pedaço.
- Use "other" apenas quando há dano evidente que nenhuma das outras categorias descreve.
- Se a foto estiver desfocada, escura ou enquadrada demais para julgar, registre isso em "unusable" em vez de adivinhar.
- Confiança abaixo de 50 significa que a oficina precisa conferir presencialmente.`;

function parseDataUrl(dataUrl: string): { media_type: string; data: string } | null {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, mediaType, data] = match;
  if (!ALLOWED_MEDIA.includes(mediaType as (typeof ALLOWED_MEDIA)[number])) return null;
  return { media_type: mediaType, data };
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    // O detalhe técnico vai pro log; o cliente vê o que pode fazer.
    console.warn("analyze-damage: ANTHROPIC_API_KEY não definida (Vercel → Settings → Environment Variables).");
    return NextResponse.json({ error: "not_configured", message: UNAVAILABLE }, { status: 503 });
  }

  if (isCrossOrigin(req)) {
    return NextResponse.json({ error: "forbidden", message: "Origem não permitida." }, { status: 403 });
  }

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json(
      {
        error: "too_large",
        message: "As fotos ficaram grandes demais pra análise. Tente com menos fotos.",
      },
      { status: 413 },
    );
  }

  const ipCheck = perIp.check(clientIp(req));
  if (!ipCheck.ok) return tooManyRequests(ipCheck.retryAfterSec);
  const instanceCheck = perInstance.check("total");
  if (!instanceCheck.ok) return tooManyRequests(instanceCheck.retryAfterSec);

  let body: {
    photos?: unknown;
    partHint?: unknown;
    vehicle?: { brand?: string; model?: string; year?: number };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "JSON inválido." }, { status: 400 });
  }

  const rawPhotos = Array.isArray(body.photos) ? body.photos : [];
  if (rawPhotos.length === 0) {
    return NextResponse.json(
      { error: "bad_request", message: "Envie ao menos uma foto." },
      { status: 400 },
    );
  }

  const images = rawPhotos
    .slice(0, MAX_PHOTOS)
    .filter((p): p is string => typeof p === "string")
    .map(parseDataUrl);

  if (images.some((i) => i === null)) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: "Foto em formato não suportado. Use JPEG, PNG, GIF ou WebP.",
      },
      { status: 400 },
    );
  }

  const vehicle = body.vehicle;
  const vehicleLine = vehicle?.brand
    ? `Veículo: ${vehicle.brand} ${vehicle.model ?? ""} ${vehicle.year ?? ""}`.trim()
    : "Veículo não informado.";
  const hintLine =
    typeof body.partHint === "string" && body.partHint
      ? `O usuário indicou que o dano está em "${body.partHint}". Confirme ou corrija com base nas fotos.`
      : "O usuário não indicou a peça — identifique você.";

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      output_config: {
        format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            ...(images as { media_type: string; data: string }[]).map((img) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: img.media_type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: img.data,
              },
            })),
            {
              type: "text" as const,
              text: `${vehicleLine}\n${hintLine}\n\nAvalie as ${images.length} foto(s) acima.`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "refused", message: "A análise foi recusada para estas imagens." },
        { status: 422 },
      );
    }

    const textBlock = response.content.find((b) => b.type === "text");
    let parsed: AnalysisOutput | null = null;
    if (textBlock && textBlock.type === "text") {
      try {
        parsed = JSON.parse(textBlock.text) as AnalysisOutput;
      } catch {
        parsed = null;
      }
    }

    if (!parsed) {
      return NextResponse.json(
        {
          error: "unparsed",
          message:
            response.stop_reason === "max_tokens"
              ? "A análise excedeu o limite de tokens. Tente com menos fotos."
              : "A IA não retornou um resultado no formato esperado.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ...parsed,
      model: response.model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", message: "Limite de requisições atingido. Tente em instantes." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("analyze-damage: ANTHROPIC_API_KEY inválida.");
      return NextResponse.json({ error: "auth", message: UNAVAILABLE }, { status: 502 });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return NextResponse.json(
        { error: "network", message: "A análise não respondeu. Tente de novo em instantes." },
        { status: 502 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`analyze-damage: erro da API (${err.status}): ${err.message}`);
      return NextResponse.json(
        { error: "api", message: "A análise falhou. Tente de novo em instantes." },
        { status: 502 },
      );
    }
    throw err;
  }
}
