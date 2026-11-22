#!/usr/bin/env bash
# Escribe api/.env.testnet (ignorado por git) con secretos. No imprime secretos.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
OUT="$RAIZ/api/.env.testnet"
ID_FILE="$RAIZ/contracts/.folios-contract-id"
FOLIOS_ID="${FOLIOS_CONTRACT_ID:-$(cat "$ID_FILE" 2>/dev/null || true)}"
ASSET_CONTRACT_ID="$(stellar contract id asset --asset "$ASSET" --network "$NET")"

# Variables que pone el usuario a mano (no salen de stellar-cli): se conservan entre regeneraciones.
CONSERVAR='^(TW_API_KEY|TW_API_URL|DATABASE_URL|DEMO_RESET_TOKEN|POLLAR_[A-Z_]*|TIPO_CAMBIO_BOB)='
PREVIAS="$(grep -E "$CONSERVAR" "$OUT" 2>/dev/null || true)"
EXTRA="$RAIZ/api/.env.extra"   # opcional, ignorado por git: aquí se pega TW_API_KEY=...

umask 077
{
  for n in "${CUENTAS[@]}"; do
    rol="${n#utama-}"; rol="$(echo "$rol" | tr 'a-z-' 'A-Z_')"
    echo "STELLAR_SECRET_${rol}=$(stellar keys secret "$n")"
    echo "STELLAR_PUBLIC_${rol}=$(stellar keys address "$n")"
  done
  # Verificadores extra del contrato utama-folios-v2 (multifirma 2 de 3, fase 2). Opcionales.
  for n in utama-verif-2 utama-verif-3; do
    stellar keys address "$n" >/dev/null 2>&1 || continue
    rol="$(echo "${n#utama-}" | tr 'a-z-' 'A-Z_')"
    echo "STELLAR_PUBLIC_${rol}=$(stellar keys address "$n")"
    echo "STELLAR_SECRET_${rol}=$(stellar keys secret "$n")"
  done
  V2_ID="$(stellar contract alias show utama-folios-v2 --network "$NET" 2>/dev/null || true)"
  [ -n "$V2_ID" ] && echo "FOLIOS_V2_CONTRACT_ID=$V2_ID"
  echo "FOLIOS_CONTRACT_ID=$FOLIOS_ID"
  echo "ASSET_CODE=USDC"
  echo "ASSET_ISSUER=$ISSUER"
  echo "ASSET_CONTRACT_ID=$ASSET_CONTRACT_ID"
  echo "STELLAR_RPC_URL=$RPC_URL"
  echo "STELLAR_HORIZON_URL=$HORIZON_URL"
  echo "STELLAR_NETWORK_PASSPHRASE=\"$PASSPHRASE\""
  echo "ANTICRETICO_MODE=testnet"
  # Regla del plan: con menos de 60 USDC de testnet en total, escala 1:10.000 (se puede forzar con DEMO_ESCALA=1000).
  echo "DEMO_ESCALA=${DEMO_ESCALA:-10000}"
  [ -f "$EXTRA" ] && grep -E '^[A-Z_]+=' "$EXTRA" || true
  [ -n "$PREVIAS" ] && echo "$PREVIAS" | while IFS= read -r l; do k="${l%%=*}"; [ -f "$EXTRA" ] && grep -q "^$k=" "$EXTRA" && continue; echo "$l"; done || true
} > "$OUT"
echo "escrito $OUT ($(wc -l < "$OUT") variables; secretos no impresos)"
