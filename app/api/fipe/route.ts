import { NextResponse } from "next/server";
import { lookupFipe, FipeError } from "@/lib/fipe";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand")?.trim();
  const model = searchParams.get("model")?.trim();
  const year = Number.parseInt(searchParams.get("year") ?? "", 10);

  if (!brand || !model || !Number.isFinite(year)) {
    return NextResponse.json(
      { error: "bad_request", message: "Informe brand, model e year." },
      { status: 400 },
    );
  }

  try {
    const result = await lookupFipe(brand, model, year);

    if (!result) {
      // Não é erro: muitos modelos do catálogo 3D (carros de corrida, conceitos)
      // simplesmente não existem na FIPE. Quem chama cai na heurística.
      return NextResponse.json(
        { found: false, reason: "Veículo não encontrado na tabela FIPE." },
        { status: 200 },
      );
    }

    return NextResponse.json({ found: true, ...result });
  } catch (err) {
    if (err instanceof FipeError) {
      return NextResponse.json(
        { found: false, error: err.kind, reason: err.message },
        { status: err.kind === "quota" ? 429 : 502 },
      );
    }
    if (err instanceof Error && err.name === "TimeoutError") {
      return NextResponse.json(
        { found: false, error: "timeout", reason: "A API da FIPE não respondeu a tempo." },
        { status: 504 },
      );
    }
    throw err;
  }
}
