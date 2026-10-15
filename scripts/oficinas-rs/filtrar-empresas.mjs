#!/usr/bin/env node
/**
 * Lê o CSV de Empresas pela entrada padrão e imprime a razão social apenas dos
 * CNPJs básicos que interessam (os que o passo anterior encontrou), para não
 * carregar 60 milhões de registros na memória.
 *
 * Layout: 0 cnpj_basico | 1 razao_social | 4 capital_social | 5 porte_empresa
 */

import fs from "fs";
import readline from "readline";

const arquivoCnpjs = process.argv[2];
if (!arquivoCnpjs) {
  console.error("uso: filtrar-empresas.mjs <arquivo-com-cnpjs-basicos>");
  process.exit(1);
}

const interessam = new Set(
  fs.readFileSync(arquivoCnpjs, "utf8").split(/\r?\n/).filter(Boolean),
);

const PORTE = { "01": "MEI/ME", "03": "EPP", "05": "Demais" };

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let achadas = 0;

for await (const linha of rl) {
  if (!linha) continue;
  const c = linha.split(";").map((x) => x.replace(/^"|"$/g, "").trim());
  if (c.length < 6) continue;
  if (!interessam.has(c[0])) continue;
  process.stdout.write(`${c[0]}\t${c[1]}\t${PORTE[c[5]] ?? ""}\n`);
  achadas++;
}

process.stderr.write(`  razões sociais encontradas: ${achadas.toLocaleString("pt-BR")}\n`);
