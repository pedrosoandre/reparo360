"use client";

import { ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/ui/empty-state";

export default function SeguroPage() {
  return (
    <DashboardShell>
      <div className="premium-card p-4 sm:p-5">
        <h1 className="text-lg font-semibold mb-4">Seguro válido</h1>
        <EmptyState
          icon={ShieldCheck}
          title="Em breve"
          description="Integração com seguradoras para validar sua apólice e agilizar sinistros. Estamos trabalhando nisso."
        />
      </div>
    </DashboardShell>
  );
}
