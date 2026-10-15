/** IDs curtos client-side. Não colidem na prática dentro do storage de um usuário. */
export function uid(prefix = ""): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36);
  return `${prefix}${prefix ? "_" : ""}${time}${rnd}`;
}

/** Código curto amigável (ex.: "R360-A3F9K") pra mostrar ao usuário. */
export function budgetCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `R360-${s}`;
}

/**
 * Hash trivial pra password. NÃO É SEGURANÇA — só evita guardar em plain text
 * enquanto o app não tem backend. Vale exatamente o que localStorage vale.
 */
export function fakeHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}
