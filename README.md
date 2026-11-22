# Utama — tu casa, sin preocupaciones

Plataforma de anticréticos verificados sobre Stellar. Proyecto para la Stellar Bolivia 2026 National Startups Hackathon.

- Definición del sistema: [utama-definicion-del-sistema.md](utama-definicion-del-sistema.md)
- Plan de la hackatón: [PLAN-HACKATON.md](PLAN-HACKATON.md)
- Guía de la parte blockchain: [PASOS-BLOCKCHAIN.md](PASOS-BLOCKCHAIN.md)
- Estado de las funcionalidades contra el documento: [FUNCIONALIDADES.md](FUNCIONALIDADES.md)
- Logo y banners (propuestas): carpeta [propuestas/](propuestas/)

## Estructura

| Carpeta | Qué es |
|---|---|
| `api/` | Backend NestJS + Prisma (PostgreSQL) |
| `web/` | Frontend Next.js + Tailwind |
| `contracts/` | Contrato Soroban en Rust *(lo crea la guía de blockchain)* |
| `propuestas/` | Logo y banners en SVG y PNG, más los generadores (`generar-marca.mjs` y `generar-ejemplos.mjs`) |
| `web/public/assets/` | **Solo el logo** que usa el frontend (`logo.svg`, `logo-claro.svg`, `isotipo.svg`) |
| `web/public/ejemplos/` | Ilustraciones de los 5 inmuebles de ejemplo (datos de demo) |
| `docker-compose.yml` | Postgres + API + web |

## Levantar todo con Docker

Requiere Docker Desktop encendido.

```powershell
docker compose up --build -d
```

| Servicio | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:3001/api (prueba: `/api/health`) |
| PostgreSQL | `localhost:5440` (usuario, contraseña y base: `utama`) |

La API crea las tablas y carga los datos de ejemplo al arrancar. Para apagar: `docker compose down` (agrega `-v` para borrar también la base de datos).

## Desarrollo (sin reconstruir imágenes)

Deja solo la base de datos en Docker y corre el resto en tu equipo:

```powershell
docker compose up -d db

cd api
npm install
npx prisma db push      # crea las tablas
npm run seed            # datos de ejemplo
npm run start:dev       # API en :3001

cd ../web
npm install
npm run dev             # web en :3000
```

Variables: `api/.env` y `web/.env.local` (hay un `.env.example` en cada carpeta).

## Modo mock y modo testnet

`NEXT_PUBLIC_MODE` en `web/.env.local`:

- `mock` (por defecto): el backend simula el contrato inteligente. Sirve para desarrollar sin Rust ni Stellar CLI.
- `testnet`: se usa el contrato Soroban real. Requiere completar `web/src/lib/anticretico/stellar.ts` (ver [PASOS-BLOCKCHAIN.md](PASOS-BLOCKCHAIN.md)).

La demo final debe correr en `testnet`.

## Usuarios de demostración

Se cambian desde la barra superior (no hay login todavía; lo reemplazará Pollar).

| Usuario | Rol |
|---|---|
| Carlos Mamani | Dueño (3 inmuebles) |
| Lucía Fernández | Dueña (2 inmuebles) |
| María Quispe | Inquilina |
| Diego Rojas | Inquilino (reside en España) |

## Guion de la demo

1. Como **Carlos**, `Publicar`: elige "Folio con hipoteca" y verifica. Se rechaza. Cambia a "Folio limpio" y publica.
2. Como **María**, abre un inmueble, agenda una visita (se revela la dirección) y pulsa **Tomar en anticrético**.
3. En el contrato se ve el reparto 85 % al dueño y 15 % a la garantía, y el folio bloqueado.
4. Como **Diego**, abre el mismo inmueble e intenta tomarlo: *"Este inmueble ya tiene un anticrético activo."*
5. Como **Carlos**, aporta al plan de devolución, inicia el check-out y apruébalo. El dinero vuelve y el folio queda libre.
6. El botón ↺ de la barra superior deja la demo como al inicio.

## API (resumen)

| Ruta | Para qué |
|---|---|
| `GET /api/inmuebles` | Listado con filtros `tipo`, `ciudad`, `q`, `minMonto`, `maxMonto`, `duenoId` |
| `GET /api/inmuebles/:id?usuarioId=` | Ficha (la dirección solo se revela al dueño o a quien agendó) |
| `POST /api/inmuebles` | Publicar (exige folio verificado) |
| `POST /api/folio/verificar` | Verificación **simulada** del Folio Real; devuelve el hash |
| `GET /api/folio/:hash/estado` | ¿Folio bloqueado? |
| `GET/POST /api/inmuebles/:id/disponibilidad`, `POST/GET /api/visitas` | Calendario y visitas |
| `POST/GET /api/ofertas`, `PATCH /api/ofertas/:id` | Ofertas |
| `POST /api/contratos`, `GET /api/contratos/:id` | Crear y ver el contrato |
| `POST /api/contratos/:id/aportes` | Aporte al plan de devolución |
| `POST /api/contratos/:id/checkout/{iniciar,reclamar,aprobar}` | Check-out |
| `GET/PUT /api/contratos/:id/inventario/:fase`, `POST …/firmar` | Inventario de check-in y check-out |
| `POST /api/uploads` | Subir fotos |
| `POST /api/demo/reset` | Reiniciar la demo |
