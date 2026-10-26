/**
 * Caixa do viewer do carro — a mesma no 3D, no 2D e no placeholder de
 * carregamento, pra não pular o layout quando um troca pelo outro.
 *
 * Abaixo de `lg` (celular e tablet, coluna única) fica mais alta (4:3) e
 * mostra o carro inteiro. Esses valores estão calibrados e não mudam.
 *
 * Do `lg` pra cima o carro é o assunto da tela, então a caixa cresce: a
 * proporção passa de 16:8 para 3:2 e o teto sobe de 38vh para 58vh. A largura
 * vem de fora — a coluna do meio do dashboard foi alargada à custa das
 * laterais.
 */
export const VIEWER_BOX =
  "w-full aspect-[4/3] min-h-[260px] max-h-[55vh] lg:aspect-[3/2] lg:min-h-[340px] lg:max-h-[58vh]";
