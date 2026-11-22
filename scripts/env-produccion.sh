#!/usr/bin/env bash
# D1-14: arma los .env de producción a partir de api/.env.testnet (llaves, contrato, TW) y el dominio público.
# Uso:  bash scripts/env-produccion.sh utama.midominio.com
# Escribe (ignorados por git, permisos 600):
#   api/.env.produccion   -> variables de la API (incluye secretos)
#   web/.env.produccion   -> variables de build de la web (NEXT_PUBLIC_*) + DEMO_RESET_TOKEN (solo servidor)
# No imprime secretos. Se entregan al Dev-3 por un canal privado (nunca git, chat ni correo).
# Variables opcionales: ENV_TESTNET (origen), OUT_API, OUT_WEB, DATABASE_URL, NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY,
# DEMO_RESET_TOKEN (si no se da, se conserva el del archivo anterior o se genera uno nuevo).
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DOMINIO="${1:-}"
if [ -z "$DOMINIO" ] || [[ "$DOMINIO" == *"/"* ]]; then
  echo "uso: bash scripts/env-produccion.sh <dominio sin https:// ni barras, p. ej. utama.midominio.com>" >&2
  exit 1
fi
ORIGEN="${ENV_TESTNET:-$RAIZ/api/.env.testnet}"
OUT_API="${OUT_API:-$RAIZ/api/.env.produccion}"
OUT_WEB="${OUT_WEB:-$RAIZ/web/.env.produccion}"
[ -f "$ORIGEN" ] || { echo "falta $ORIGEN (correr antes: bash scripts/exportar-env.sh)" >&2; exit 1; }

# Valor de una variable en un archivo .env (última aparición; sin comillas externas).
valor() { grep -E "^$1=" "$2" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }

TOKEN="${DEMO_RESET_TOKEN:-$(valor DEMO_RESET_TOKEN "$OUT_API")}"
[ -n "$TOKEN" ] || TOKEN="$(openssl rand -hex 24)"
POLLAR="${NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY:-$(valor NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY "$OUT_WEB")}"
DB="${DATABASE_URL:-postgresql://utama:utama@db:5432/utama?schema=public}"
URL="https://$DOMINIO"

# Lo que se fija aquí no se copia del origen.
PROPIAS='^(DATABASE_URL|PORT|WEB_ORIGIN|PUBLIC_API_URL|DEMO_RESET_TOKEN|ANTICRETICO_MODE|VENCIMIENTOS_AUTO|RECONCILIAR_AUTO|TTL_AUTO)='

umask 077
{
  echo "# Generado por scripts/env-produccion.sh para $DOMINIO. Contiene secretos: no versionar."
  echo "DATABASE_URL=$DB"
  echo "PORT=3001"
  echo "WEB_ORIGIN=$URL"
  echo "PUBLIC_API_URL=$URL"
  echo "ANTICRETICO_MODE=testnet"
  echo "DEMO_RESET_TOKEN=$TOKEN"
  # En producción se encienden los procesos automáticos (vencimiento de inscripción y reconciliación).
  echo "VENCIMIENTOS_AUTO=1"
  echo "RECONCILIAR_AUTO=1"
  echo "TTL_AUTO=1"
  grep -E '^[A-Z_][A-Z0-9_]*=' "$ORIGEN" | grep -Ev "$PROPIAS" || true
} > "$OUT_API"

{
  echo "# Generado por scripts/env-produccion.sh para $DOMINIO. Variables de BUILD de la web."
  echo "NEXT_PUBLIC_API_URL=$URL/api"
  echo "NEXT_PUBLIC_MODE=testnet"
  echo "NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=$POLLAR"
  echo "# Solo servidor (nunca NEXT_PUBLIC_): el mismo token que la API"
  echo "DEMO_RESET_TOKEN=$TOKEN"
} > "$OUT_WEB"

# Validación: la API arranca con esta config (lanza nombrando la variable que falta). No imprime valores.
( cd "$RAIZ/api" && OUT_API="$OUT_API" npx --no-install tsx -e "
(async () => {
  const { parseEnv } = await import('node:util');
  const { readFileSync } = await import('node:fs');
  const { cargarStellarConfig } = await import('./src/stellar/stellar.config.ts');
  const env = parseEnv(readFileSync(process.env.OUT_API, 'utf8'));
  try {
    const c = cargarStellarConfig(env);
    console.log('config OK: modo ' + c.modo + ', folios v' + (c.foliosVersion ?? 1) + ' ' + c.foliosContractId + ', escala 1:' + c.escala);
  } catch (e) { console.error('config INVÁLIDA: ' + e.message); process.exit(1); }
})();
" )

echo "escrito $OUT_API ($(grep -c '=' "$OUT_API") variables) y $OUT_WEB; secretos no impresos"
[ -n "$POLLAR" ] || echo "AVISO: falta NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY (sin ella la web no monta Pollar). Repetir con esa variable definida."
echo "Pollar: agregar $URL en Developers → Websites → Allowed origins."
