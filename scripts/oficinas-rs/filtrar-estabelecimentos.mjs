#!/usr/bin/env node
/**
 * Lê um CSV de Estabelecimentos da Receita Federal pela entrada padrão e imprime
 * apenas as oficinas do RS com celular. Feito para receber `unzip -p` num pipe,
 * de modo que os 5+ GB nunca precisam ser descompactados em disco.
 *
 * Layout do arquivo (sem cabeçalho, ";" como separador, encoding latin-1):
 *   0 cnpj_basico            12 cnae_fiscal_secundaria
 *   1 cnpj_ordem             19 uf
 *   2 cnpj_dv                20 municipio (código IBGE/RFB)
 *   4 nome_fantasia          21 ddd_1     22 telefone_1
 *   5 situacao_cadastral     23 ddd_2     24 telefone_2
 *  11 cnae_fiscal_principal  27 correio_eletronico
 */

import readline from "readline";

const UF_ALVO = process.env.UF ?? "RS";
const SO_ATIVAS = process.env.SO_ATIVAS !== "0";

/** CNAEs de oficina. Ajuste conforme o público que você quer atingir. */
const CNAE_OFICINA = new Set(
  (process.env.CNAES ??
    [
      "4520001", // manutenção e reparação mecânica
      "4520002", // lanternagem / funilaria e pintura
      "4520003", // manutenção e reparação elétrica
      "4520004", // alinhamento e balanceamento
      "4520005", // lavagem, lubrificação e polimento
      "4520006", // borracharia
      "4520007", // instalação/reparação de acessórios
      "4520008", // capotaria
    ].join(",")
  ).split(","),
);

/** DDDs do Rio Grande do Sul. */
const DDD_RS = new Set(["51", "53", "54", "55"]);

/**
 * No Brasil, celular tem 9 dígitos e começa em 9; fixo tem 8 e começa em 2–5.
 * É a única forma confiável de separar os dois nesta base.
 */
function ehCelular(numero) {
  const d = numero.replace(/\D/g, "");
  return d.length === 9 && d.startsWith("9");
}

function campos(linha) {
  // Os campos vêm sempre entre aspas duplas; não há ";" dentro dos valores.
  return linha.split(";").map((c) => c.replace(/^"|"$/g, "").trim());
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

let lidas = 0;
let emitidas = 0;

for await (const linha of rl) {
  if (!linha) continue;
  lidas++;

  const c = campos(linha);
  if (c.length < 25) continue;

  if (c[19] !== UF_ALVO) continue;
  if (SO_ATIVAS && c[5] !== "02") continue; // 02 = ativa

  // Guarda o CNAE que caracterizou a oficina — pode estar na atividade
  // secundária (ex.: loja de pneus que também faz borracharia).
  const principal = c[11];
  const secundarias = c[12] ? c[12].split(",") : [];
  const cnaeOficina = CNAE_OFICINA.has(principal)
    ? principal
    : secundarias.find((s) => CNAE_OFICINA.has(s));
  if (!cnaeOficina) continue;

  // Prioriza telefone_1; usa telefone_2 se o primeiro não for celular.
  const candidatos = [
    { ddd: c[21], num: c[22] },
    { ddd: c[23], num: c[24] },
  ];
  const cel = candidatos.find((t) => DDD_RS.has(t.ddd) && ehCelular(t.num));
  if (!cel) continue;

  const cnpj = `${c[0]}${c[1]}${c[2]}`;
  const saida = [
    cnpj,
    c[4] || "", // nome fantasia (pode vir vazio -> completado pelo passo Empresas)
    `+55${cel.ddd}${cel.num.replace(/\D/g, "")}`,
    c[20], // código do município
    cnaeOficina,
    (c[27] || "").toLowerCase(),
  ];
  // TSV evita conflito com vírgulas em nomes de empresa
  process.stdout.write(saida.join("\t") + "\n");
  emitidas++;
}

process.stderr.write(
  `  linhas lidas: ${lidas.toLocaleString("pt-BR")} | oficinas ${UF_ALVO} com celular: ${emitidas.toLocaleString("pt-BR")}\n`,
);
