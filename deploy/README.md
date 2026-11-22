# Despliegue en la VPS (utama.devsjec.com)

Todo corre con Docker: Postgres + API (NestJS) + web (Next) + Caddy (HTTPS automático con Let's Encrypt).

## 0. Requisitos (una vez)
- DNS: registro **A** `utama.devsjec.com` → IP pública de la VPS (esperar a que resuelva: `dig +short utama.devsjec.com`).
- Puertos **80 y 443** abiertos en el firewall (`ufw allow 80,443/tcp`).
- Docker + plugin compose (`curl -fsSL https://get.docker.com | sh`).

## 1. Código
```bash
git clone https://github.com/<org>/<repo>.git utama && cd utama
git checkout main          # o la rama que indique el Dev-1
```

## 2. Secretos
El Dev-1 entrega por canal privado **un solo archivo** `utama-secretos.sh`. En la raíz del repo:
```bash
bash /ruta/a/utama-secretos.sh   # crea api/.env.produccion y web/.env.produccion (permisos 600)
```
Nunca subir esos archivos a git (ya están ignorados).

## 3. Levantar
```bash
docker compose -f deploy/docker-compose.prod.yml --env-file web/.env.produccion up -d --build
docker compose -f deploy/docker-compose.prod.yml logs -f api   # esperar "Nest application successfully started"
```
Al arrancar, la API crea las tablas, carga los datos demo y atesta los folios en el contrato `utama-folios` (testnet).

## 4. Comprobar
```bash
curl -s https://utama.devsjec.com/api/config           # modo testnet + contrato
curl -s https://utama.devsjec.com/api/inmuebles | head -c 300
```
Abrir `https://utama.devsjec.com` en el navegador.

## Actualizar a una versión nueva
```bash
bash deploy/desplegar.sh   # git pull de main + rebuild + comprobaciones (health, config, metricas)
```
Las variables `NEXT_PUBLIC_*` se incorporan al build de la web: si cambian, hay que reconstruir (`--build`).

## Problemas comunes
- **Caddy no obtiene el certificado:** el DNS todavía no apunta a la VPS o el puerto 80 está cerrado.
- **La web llama a localhost:** se construyó sin `--env-file web/.env.produccion`. Repetir el `up -d --build` con ese flag.
- **Borrar todo y empezar de cero (borra la base):** `docker compose -f deploy/docker-compose.prod.yml down -v`.
