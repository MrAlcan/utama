#!/usr/bin/env bash
# V-04: actualiza la VPS con main y comprueba que responde. Uso (en la raíz del repo, en la VPS): bash deploy/desplegar.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
DOMINIO="${DOMINIO:-utama.devsjec.com}"
[ -f api/.env.produccion ] && [ -f web/.env.produccion ] || { echo "faltan api/.env.produccion o web/.env.produccion (correr utama-secretos.sh)"; exit 1; }
git pull --ff-only origin main
docker compose -f deploy/docker-compose.prod.yml --env-file web/.env.produccion up -d --build
echo "esperando a la API…"
for i in $(seq 1 60); do curl -sf "https://$DOMINIO/api/health" >/dev/null && break; sleep 5; done
echo "web:    $(curl -s -o /dev/null -w '%{http_code}' "https://$DOMINIO/")"
echo "health: $(curl -s "https://$DOMINIO/api/health")"
echo "config: $(curl -s "https://$DOMINIO/api/config" | head -c 200)"
echo "metricas: $(curl -s "https://$DOMINIO/api/metricas" | head -c 200)"
