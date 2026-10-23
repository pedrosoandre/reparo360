import type { ReactNode } from "react";

/**
 * Barra de ação fixa no rodapé, só no celular (< lg). Carrega a ação que
 * conclui a tela (Finalizar, Enviar, Continuar) pra ela não ficar a duas telas
 * de distância, atrás da lista. Do `lg` pra cima some e a ação continua no
 * lugar de sempre.
 *
 * O espaçador reserva a altura da barra no fim da página; sem ele a barra
 * cobriria o rodapé e o último card. Fundo sólido, sem blur: o conteúdo que
 * passa por baixo não deve aparecer atrás do texto.
 */
export function MobileActionBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-24 lg:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_30px_-12px_rgba(0,0,0,0.6)] lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">{children}</div>
      </div>
    </>
  );
}
