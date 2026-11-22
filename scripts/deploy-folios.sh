#!/usr/bin/env bash
# Build + deploy de utama-folios en testnet. Guarda el ID en contracts/.folios-contract-id
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$RAIZ/contracts"
stellar contract build >&2
ADMIN="$(stellar keys address utama-verificador)"
ID="$(stellar contract deploy --wasm target/wasm32v1-none/release/utama_folios.wasm \
  --source-account utama-verificador --network "$NET" --alias utama-folios -- --admin "$ADMIN" | tail -1)"
echo "$ID" > "$RAIZ/contracts/.folios-contract-id"
echo "FOLIOS_CONTRACT_ID=$ID"
echo "wasm sha256: $(sha256sum target/wasm32v1-none/release/utama_folios.wasm | cut -d' ' -f1)"
