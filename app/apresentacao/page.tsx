import Link from "next/link";
import { ArrowRight, Sparkles, ShieldCheck, Zap, Cpu, LineChart, FileText } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { PremiumButton } from "@/components/ui/premium-button";
import { Car3DLazy } from "@/components/car/car-3d-lazy";

const FEATURES = [
  {
    icon: Cpu,
    title: "IA de reconhecimento de danos",
    desc: "Detecção automática de peças, severidade e área afetada com visão computacional.",
  },
  {
    icon: Zap,
    title: "Pré-orçamento em segundos",
    desc: "Motor de precificação baseado em zonas, tipos de dano e severidade — resultados instantâneos.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-tenant e white-label",
    desc: "Sua oficina com subdomínio próprio, cores, logo e tabela de preços personalizada.",
  },
  {
    icon: FileText,
    title: "PDF profissional",
    desc: "Orçamentos elegantes em A4 com fotos, diagrama e faixa de precisão para enviar ao cliente.",
  },
  {
    icon: LineChart,
    title: "Dashboard analítico",
    desc: "Conversão, ticket médio, peças mais danificadas e tempo de resposta em tempo real.",
  },
  {
    icon: Sparkles,
    title: "Integração WhatsApp",
    desc: "Envie orçamentos, confirmações e atualizações direto pelo WhatsApp Cloud API.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen grid-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl border-b border-[color:var(--color-border)] bg-bg/70">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[color:var(--color-primary)] to-[color:var(--color-primary-soft)] flex items-center justify-center text-white font-bold">
              R
            </div>
            <span className="font-semibold tracking-tight text-lg">Reparo360</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-text-secondary">
            <a href="#recursos" className="hover:text-text transition-colors">Recursos</a>
            <a href="#como-funciona" className="hover:text-text transition-colors">Como funciona</a>
            <a href="#precos" className="hover:text-text transition-colors">Preços</a>
            <Link href="/dashboard" className="hover:text-text transition-colors">Abrir app</Link>
          </nav>
          <Link href="/solicitar">
            <PremiumButton size="sm">
              Testar grátis
              <ArrowRight size={16} />
            </PremiumButton>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary)]/10 px-3 py-1 text-xs text-[color:var(--color-primary-soft)] mb-6">
              <Sparkles size={12} />
              Assistente de orçamento com IA
            </span>
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              O orçamento da sua oficina agora é <span className="text-gradient">visual e instantâneo</span>.
            </h1>
            <p className="mt-6 text-lg text-text-secondary max-w-lg leading-relaxed">
              Reparo360 transforma cliques em orçamentos precisos. Seu cliente aponta o dano, envia fotos, e a IA gera o pré-orçamento em segundos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/solicitar">
                <PremiumButton size="lg">
                  Criar orçamento
                  <ArrowRight size={18} />
                </PremiumButton>
              </Link>
              <Link href="/dashboard">
                <PremiumButton size="lg" variant="secondary">
                  Ver dashboard
                </PremiumButton>
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-8 text-sm text-text-secondary">
              <div>
                <p className="text-2xl font-semibold text-text">+40%</p>
                <p>de conversão</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-text">3x</p>
                <p>mais leads qualificados</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-text">30s</p>
                <p>por orçamento</p>
              </div>
            </div>
          </div>

          <GlassCard glow className="p-8">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-text-secondary">Toque na peça danificada</p>
              <span className="text-xs bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary-soft)] rounded-full px-2 py-1">
                Demo interativa
              </span>
            </div>
            <Car3DLazy selectedParts={["front_bumper", "fender_left"]} interactive={false} autoRotate showHotspots={false} />
          </GlassCard>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="max-w-7xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Tudo que sua oficina precisa em um só lugar
          </h2>
          <p className="mt-3 text-text-secondary max-w-xl mx-auto">
            Uma stack premium pensada para escala, multi-tenant, com IA e integrações prontas.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <GlassCard key={f.title} className="hover:border-[color:var(--color-primary)]/40 hover:-translate-y-0.5">
              <div className="w-11 h-11 rounded-2xl bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary-soft)] flex items-center justify-center mb-4">
                <f.icon size={20} />
              </div>
              <h3 className="text-lg font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="precos" className="max-w-5xl mx-auto px-6 pb-24">
        <GlassCard glow className="p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Comece agora. Grátis por 14 dias.
          </h2>
          <p className="mt-3 text-text-secondary">
            Sem cartão. Configure sua oficina em 5 minutos e receba o primeiro orçamento hoje.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/solicitar">
              <PremiumButton size="lg">
                Testar Reparo360
                <ArrowRight size={18} />
              </PremiumButton>
            </Link>
          </div>
        </GlassCard>
      </section>

      <footer className="border-t border-[color:var(--color-border)] py-8 text-center text-sm text-text-secondary">
        © {new Date().getFullYear()} Reparo360. Todos os direitos reservados.
      </footer>
    </div>
  );
}
