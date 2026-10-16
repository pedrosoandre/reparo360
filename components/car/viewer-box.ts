/**
 * Caixa do viewer do carro — a mesma no 3D, no 2D e no placeholder de
 * carregamento, pra não pular o layout quando um troca pelo outro.
 *
 * Abaixo de `lg` (celular e tablet, coluna única) fica mais alta (4:3) e
 * mostra o carro inteiro; do `lg` pra cima volta pro formato largo que cabe
 * na coluna do meio do dashboard.
 */
export const VIEWER_BOX =
  "w-full aspect-[4/3] min-h-[260px] max-h-[55vh] lg:aspect-[16/8] lg:min-h-[220px] lg:max-h-[38vh]";
