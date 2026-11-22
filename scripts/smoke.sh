#!/usr/bin/env bash
# Smoke: atestar -> bloquear -> 2.o bloquear (debe fallar #2) -> consultar -> liberar.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ID="${FOLIOS_CONTRACT_ID:-$(cat "$RAIZ/contracts/.folios-contract-id")}"
MAT="SMOKE$(date +%s)"   # matricula unica por corrida
F="$(printf '%s' "$MAT" | sha256sum | cut -d' ' -f1)"
inv() { stellar contract invoke --id "$ID" --source-account utama-verificador --network "$NET" -- "$@"; }
G() { stellar keys address "$1"; }
VENCE=$(( $(date +%s) + 63072000 ))
ESCROW="$(stellar contract id asset --asset "$ASSET" --network "$NET")"  # un C... valido hace de escrow de prueba

echo "== atestar"; inv atestar_folio --folio "$F" --dueno "$(G utama-carlos)" >/dev/null
echo "== bloquear (maria)"; inv bloquear --folio "$F" --inquilino "$(G utama-maria)" --escrow "$ESCROW" --vence "$VENCE" >/dev/null
echo "== bloquear (diego): debe fallar"
if SALIDA="$(inv bloquear --folio "$F" --inquilino "$(G utama-diego)" --escrow "$ESCROW" --vence "$VENCE" 2>&1)"; then
  echo "FALLO: el doble anticretico NO fue rechazado"; exit 1
fi
echo "$SALIDA" | grep -q '#2' || { echo "FALLO: error distinto de #2"; echo "$SALIDA"; exit 1; }
echo "OK rechazado: Error(Contract, #2) FolioOcupado"
echo "== consultar"; inv consultar --folio "$F"
echo "== liberar"; inv liberar --folio "$F" --motivo Finalizado >/dev/null
echo "== consultar"; inv consultar --folio "$F"
echo "SMOKE OK (folio $F)"
