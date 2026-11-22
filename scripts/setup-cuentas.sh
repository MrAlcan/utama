#!/usr/bin/env bash
# Crea (si faltan) las 8 identidades de testnet, las fondea y agrega trustline a USDC (Circle).
# Idempotente. Imprime solo direcciones publicas.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

for n in "${CUENTAS[@]}"; do
  if ! stellar keys address "$n" >/dev/null 2>&1; then
    stellar keys generate "$n" --network "$NET" --fund >/dev/null 2>&1
  fi
  # trustline (si ya existe, change-trust es no-op)
  stellar tx new change-trust --line "$ASSET" --source-account "$n" --network "$NET" >/dev/null 2>&1 \
    || echo "aviso: change-trust fallo para $n (reintenta)" >&2
  printf '%-18s %s\n' "$n" "$(stellar keys address "$n")"
done
