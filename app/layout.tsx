import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Reparo360 — Orçamento visual assistido por IA",
  description:
    "Plataforma SaaS premium para oficinas de funilaria, pintura e mecânica. Orçamentos instantâneos com IA.",
};

/**
 * Sem esta config o Next.js emite viewport=980px por padrão, e navegadores
 * móveis renderizam a página em ~980 lógicos escalando para caber — todo o
 * conteúdo aparece minúsculo. `viewportFit: "cover"` faz o app ocupar a área
 * de notch/safe-area em iPhones.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0B0F",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-bg text-text antialiased overflow-x-hidden">
        {children}
        <ConfirmDialog />
        <Toaster />
      </body>
    </html>
  );
}
