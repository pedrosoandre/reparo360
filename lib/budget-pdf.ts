/**
 * Gera PDF do orçamento (client-side, via jspdf). Baixado direto no browser
 * como `<code>.pdf`. Sem backend/servidor de renderização.
 *
 * Layout:
 *   - Cabeçalho colorido "REPARO360" com código e data
 *   - Bloco do veículo e cliente
 *   - Tabela de peças com dano (peça, tipo, custo)
 *   - Tabela de serviços extras
 *   - Totais destacados no rodapé
 *   - Rodapé com estimativa + versão da tabela de preço
 */
import type { Budget } from "@/types";
import { formatBRL, formatDate } from "@/lib/utils";
import { DAMAGE_LABELS } from "@/lib/car-parts";

const PRIMARY = "#4F6BFF";
const INK = "#111318";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";

export async function generateBudgetPDF(
  budget: Budget,
  opts?: { oficinaNome?: string; oficinaCidade?: string },
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40; // margem

  // Cabeçalho colorido
  doc.setFillColor(PRIMARY);
  doc.rect(0, 0, W, 80, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("REPARO360", M, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Estimativa de reparo automotivo", M, 60);

  // Código + status na direita do header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(budget.code, W - M, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Emitido em ${formatDate(budget.createdAt)}`,
    W - M,
    60,
    { align: "right" },
  );

  let y = 110;
  doc.setTextColor(INK);

  // Bloco veículo/cliente
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Veículo", M, y);
  doc.text("Cliente", W / 2, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `${budget.vehicleSnapshot.brand} ${budget.vehicleSnapshot.model} · ${budget.vehicleSnapshot.year}`,
    M,
    y,
  );
  doc.text(budget.customerName || "—", W / 2, y);
  y += 14;
  if (budget.vehicleSnapshot.color) {
    doc.setTextColor(MUTED);
    doc.text(`Cor: ${budget.vehicleSnapshot.color}`, M, y);
    doc.setTextColor(INK);
  }
  if (budget.customerPhone) {
    doc.setTextColor(MUTED);
    doc.text(budget.customerPhone, W / 2, y);
    doc.setTextColor(INK);
  }
  y += 20;

  // Bloco oficina (se destinado)
  if (opts?.oficinaNome) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Enviado para", M, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `${opts.oficinaNome}${opts.oficinaCidade ? ` — ${opts.oficinaCidade}` : ""}`,
      M,
      y,
    );
    y += 20;
  }

  // Divisor
  doc.setDrawColor(LINE);
  doc.line(M, y, W - M, y);
  y += 20;

  // Peças & danos
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Peças com dano (${budget.items.length})`, M, y);
  y += 12;
  doc.setDrawColor(LINE);
  doc.line(M, y, W - M, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Peça", M, y);
  doc.text("Dano", 200, y);
  doc.text("Custo estimado", W - M, y, { align: "right" });
  y += 12;
  doc.setDrawColor(LINE);
  doc.line(M, y, W - M, y);
  y += 6;
  doc.setFont("helvetica", "normal");

  for (const item of budget.items) {
    if (y > H - 120) {
      doc.addPage();
      y = 60;
    }
    y += 12;
    doc.text(item.partLabel, M, y);
    const dano = item.damages.map((d) => DAMAGE_LABELS[d] ?? d).join(", ");
    const wrappedDano = doc.splitTextToSize(dano, W / 2 - 40) as string[];
    doc.text(wrappedDano[0] ?? "", 200, y);
    doc.text(formatBRL(item.estimatedCost), W - M, y, { align: "right" });
    if (wrappedDano.length > 1) {
      for (let i = 1; i < wrappedDano.length; i++) {
        y += 11;
        doc.setTextColor(MUTED);
        doc.text(wrappedDano[i], 200, y);
        doc.setTextColor(INK);
      }
    }
  }
  y += 14;
  doc.setDrawColor(LINE);
  doc.line(M, y, W - M, y);

  // Serviços extras
  const extras = budget.extras ?? [];
  if (extras.length) {
    y += 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Serviços extras (${extras.length})`, M, y);
    y += 12;
    doc.setDrawColor(LINE);
    doc.line(M, y, W - M, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const e of extras) {
      y += 14;
      doc.text(e.label, M, y);
      doc.text(formatBRL(e.price), W - M, y, { align: "right" });
    }
  }

  // Totais
  const extrasTotal = extras.reduce((a, b) => a + b.price, 0);
  const grand = budget.total + extrasTotal;
  y += 26;
  if (y > H - 120) {
    doc.addPage();
    y = 60;
  }
  doc.setDrawColor(LINE);
  doc.line(M, y, W - M, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Reparo estimado", W - M - 200, y);
  doc.text(formatBRL(budget.total), W - M, y, { align: "right" });
  y += 14;
  doc.text("Serviços extras", W - M - 200, y);
  doc.text(formatBRL(extrasTotal), W - M, y, { align: "right" });
  y += 20;
  doc.setFillColor(PRIMARY);
  doc.rect(W - M - 220, y - 14, 220, 24, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL", W - M - 210, y);
  doc.text(formatBRL(grand), W - M - 10, y, { align: "right" });
  doc.setTextColor(INK);

  // Rodapé
  const footerY = H - 40;
  doc.setDrawColor(LINE);
  doc.line(M, footerY - 14, W - M, footerY - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(
    "Estimativa gerada automaticamente pelo Reparo360. Valores sujeitos a confirmação da oficina.",
    M,
    footerY,
  );
  doc.text(
    `Confiança: ${budget.confidence}% · Preço v${budget.pricingVersion}`,
    W - M,
    footerY,
    { align: "right" },
  );

  return doc.output("blob");
}

export async function downloadBudgetPDF(
  budget: Budget,
  opts?: { oficinaNome?: string; oficinaCidade?: string },
): Promise<void> {
  const blob = await generateBudgetPDF(budget, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${budget.code}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
