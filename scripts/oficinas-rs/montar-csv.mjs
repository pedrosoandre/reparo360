#!/usr/bin/env node
/**
 * Junta os três arquivos intermediários e gera o CSV final, com uma linha por
 * celular único. Quando duas oficinas compartilham o mesmo número (comum em
 * redes e em MEI com mais de um CNPJ), mantém a primeira e conta a repetição.
 */

import fs from "fs";

const [oficinasTsv, razoesTsv, municipiosCsv] = process.argv.slice(2);

const CNAE_LABEL = {
  "4520001": "Mecânica",
  "4520002": "Funilaria e pintura",
  "4520003": "Elétrica",
  "4520004": "Alinhamento e balanceamento",
  "4520005": "Lavagem e polimento",
  "4520006": "Borracharia",
  "4520007": "Acessórios",
  "4520008": "Capotaria",
  "4543900": "Motocicletas",
};

// código do município -> nome
const municipios = new Map();
for (const linha of fs.readFileSync(municipiosCsv, "latin1").split(/\r?\n/)) {
  if (!linha) continue;
  const [cod, nome] = linha.split(";").map((x) => x.replace(/^"|"$/g, "").trim());
  if (cod) municipios.set(cod, nome);
}

// cnpj básico -> { razao, porte }
const razoes = new Map();
if (fs.existsSync(razoesTsv)) {
  for (const linha of fs.readFileSync(razoesTsv, "latin1").split(/\r?\n/)) {
    if (!linha) continue;
    const [basico, razao, porte] = linha.split("\t");
    if (basico) razoes.set(basico, { razao: razao ?? "", porte: porte ?? "" });
  }
}

/**
 * A base vem toda em maiúsculas. Converte para Title Case mantendo preposições
 * minúsculas e preservando siglas conhecidas — sem tentar adivinhar por tamanho,
 * senão "CAXIAS DO SUL" virava "Caxias do SUL".
 */
const PREPOSICOES = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "a", "o"]);
const SIGLAS = new Set([
  "ltda", "me", "epp", "eireli", "sa", "s/a", "mei", "cia", "km",
  "rs", "auto", "abc", "jr", "ii", "iii", "iv",
]);

function nomeApresentavel(s) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => {
      if (i > 0 && PREPOSICOES.has(p)) return p;
      if (SIGLAS.has(p)) return p === "auto" ? "Auto" : p.toUpperCase();
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ")
    .trim();
}

const porTelefone = new Map();
let total = 0;

for (const linha of fs.readFileSync(oficinasTsv, "latin1").split(/\r?\n/)) {
  if (!linha) continue;
  total++;
  const [cnpj, fantasia, telefone, codMunicipio, cnae, email] = linha.split("\t");
  const basico = cnpj.slice(0, 8);
  const emp = razoes.get(basico);

  const bruto = (fantasia && fantasia.length > 1 ? fantasia : emp?.razao) ?? "";
  if (!bruto) continue; // sem nome não dá para personalizar a mensagem

  if (porTelefone.has(telefone)) {
    porTelefone.get(telefone).duplicados++;
    continue;
  }
  porTelefone.set(telefone, {
    nome: nomeApresentavel(bruto),
    telefone,
    municipio: municipios.get(codMunicipio) ? nomeApresentavel(municipios.get(codMunicipio)) : "",
    especialidade: CNAE_LABEL[cnae] ?? cnae,
    porte: emp?.porte ?? "",
    cnpj,
    email: email || "",
    duplicados: 0,
  });
}

const linhas = [...porTelefone.values()].sort(
  (a, b) => a.municipio.localeCompare(b.municipio, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"),
);

const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
console.log(
  ["nome", "telefone", "municipio", "especialidade", "porte", "cnpj", "email"].join(","),
);
for (const l of linhas) {
  console.log(
    [l.nome, l.telefone, l.municipio, l.especialidade, l.porte, l.cnpj, l.email].map(csv).join(","),
  );
}

process.stderr.write(
  `\n  registros lidos: ${total.toLocaleString("pt-BR")}` +
    `\n  celulares únicos: ${linhas.length.toLocaleString("pt-BR")}` +
    `\n  descartados por número repetido: ${(total - linhas.length).toLocaleString("pt-BR")}\n`,
);
