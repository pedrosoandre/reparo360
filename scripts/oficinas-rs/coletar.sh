#!/usr/bin/env bash
# Monta a lista de oficinas do RS com celular a partir dos dados abertos de CNPJ
# da Receita Federal. Faz stream: baixa cada .zip, filtra pelo pipe e apaga —
# o pico de disco é de um arquivo, não dos ~6 GB da base inteira.
#
# Uso:   bash scripts/oficinas-rs/coletar.sh
# Saída: scripts/oficinas-rs/saida/oficinas-rs.csv
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAIDA="$AQUI/saida"
TMP="$AQUI/.tmp"
TOKEN="${RFB_SHARE_TOKEN:-YggdBLfdninEJX9}"
BASE="https://arquivos.receitafederal.gov.br/public.php/dav/files/$TOKEN"
WEBDAV="https://arquivos.receitafederal.gov.br/public.php/webdav"

mkdir -p "$SAIDA" "$TMP"

echo "==> descobrindo a competência mais recente"
MES=$(curl -s -m 60 -X PROPFIND -u "$TOKEN:" -H "Depth: 1" "$WEBDAV/" \
  | grep -oE '/public\.php/webdav/[0-9]{4}-[0-9]{2}/' \
  | grep -oE '[0-9]{4}-[0-9]{2}' | sort | tail -1)
if [ -z "$MES" ]; then
  echo "ERRO: não consegui listar as competências. O share token pode ter mudado." >&2
  echo "Abra https://arquivos.receitafederal.gov.br/ > Dados > Cadastros > CNPJ" >&2
  echo "e exporte o código da URL em RFB_SHARE_TOKEN." >&2
  exit 1
fi
echo "    competência: $MES"

# ---------- Passo 1: municípios (arquivo pequeno, para traduzir o código) ----------
echo "==> municípios"
curl -sS -m 300 -u "$TOKEN:" -o "$TMP/Municipios.zip" "$BASE/$MES/Municipios.zip"
unzip -p "$TMP/Municipios.zip" > "$TMP/municipios.csv"
rm -f "$TMP/Municipios.zip"

# ---------- Passo 2: estabelecimentos (10 partes, ~5 GB) ----------
echo "==> estabelecimentos: filtrando oficinas do RS com celular"
: > "$TMP/oficinas.tsv"
for i in $(seq 0 9); do
  ARQ="Estabelecimentos$i.zip"
  echo "  [$((i+1))/10] $ARQ"
  curl -sS -m 3600 -u "$TOKEN:" -o "$TMP/$ARQ" "$BASE/$MES/$ARQ"
  unzip -p "$TMP/$ARQ" | node "$AQUI/filtrar-estabelecimentos.mjs" >> "$TMP/oficinas.tsv"
  rm -f "$TMP/$ARQ"   # libera o disco antes da próxima parte
done
echo "    subtotal: $(wc -l < "$TMP/oficinas.tsv") registros"

# ---------- Passo 3: razão social (para quem não tem nome fantasia) ----------
echo "==> empresas: completando o nome de quem não tem nome fantasia"
cut -f1 "$TMP/oficinas.tsv" | cut -c1-8 | sort -u > "$TMP/cnpjs-basicos.txt"
: > "$TMP/razoes.tsv"
for i in $(seq 0 9); do
  ARQ="Empresas$i.zip"
  echo "  [$((i+1))/10] $ARQ"
  curl -sS -m 3600 -u "$TOKEN:" -o "$TMP/$ARQ" "$BASE/$MES/$ARQ"
  unzip -p "$TMP/$ARQ" \
    | node "$AQUI/filtrar-empresas.mjs" "$TMP/cnpjs-basicos.txt" >> "$TMP/razoes.tsv"
  rm -f "$TMP/$ARQ"
done

# ---------- Passo 4: junta tudo e gera o CSV final ----------
echo "==> gerando CSV final"
node "$AQUI/montar-csv.mjs" \
  "$TMP/oficinas.tsv" "$TMP/razoes.tsv" "$TMP/municipios.csv" \
  > "$SAIDA/oficinas-rs.csv"

echo
echo "pronto: $SAIDA/oficinas-rs.csv"
echo "registros: $(( $(wc -l < "$SAIDA/oficinas-rs.csv") - 1 ))"
echo
echo "LEIA scripts/oficinas-rs/LEIA-ME.md antes de usar esses números para contato."
