FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3001
# Crea/actualiza las tablas, carga los datos de ejemplo (solo si la base está vacía), en testnet atesta los folios
# demo en utama-folios (idempotente; si la red falla no bloquea el arranque) y arranca la API.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/seed/run.js && if [ \"$ANTICRETICO_MODE\" = testnet ]; then node dist/seed/atestar.run.js || echo 'aviso: atestar fallo'; fi && node dist/main.js"]
