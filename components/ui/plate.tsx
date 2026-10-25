/**
 * Placa Mercosul: faixa azul em cima, caracteres em monoespaçada sobre branco,
 * contorno preto. É o `.r360-plate` da identidade.
 *
 * Fundo e contorno são fixos de propósito — placa é placa em qualquer tema, e
 * trocar a cor dela pelo tema a descaracterizaria.
 */
export function Plate({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span
      className={`inline-flex flex-col overflow-hidden border-[1.5px] border-[#141414] bg-white align-middle ${className}`}
    >
      <span aria-hidden className="h-[5px] bg-[#1D3A8A]" />
      <span
        className="px-[7px] py-[3px] text-[13px] font-medium tracking-[0.05em] text-[#141414]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </span>
    </span>
  );
}
