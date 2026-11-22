# Arquitectura de Utama

Utama es un marketplace de anticréticos verificados en Bolivia. El dinero del inquilino queda en un **escrow en Stellar** (Trustless Work, USDC) y llega al dueño **solo cuando el anticrético está inscrito en Derechos Reales**. Un contrato propio en Soroban, **`utama-folios`**, registra cada folio y **rechaza el doble anticrético**.

## Componentes

```
Navegador ── HTTPS ──> utama.<dominio> (proxy de la VPS)
   │                      ├ /      → web/  Next.js 16
   │                      └ /api   → api/  NestJS 12 + Prisma 7 ──> PostgreSQL 16
   │                                       │
   │  Pollar (login con Google,            ├ TwClient ── x-api-key ──> Trustless Work V2 (escrow multi-release)
   │  wallet embebida, pago firmado        │      XDR sin firmar → firma con la cuenta del rol → send-transaction
   │  por el usuario)                      ├ FoliosClient ── Soroban RPC ──> utama-folios (atestar / bloquear / liberar / consultar)
   │                                       └ Enviador ── Horizon ──> pagos USDC clásicos (devolución, fondeo)
   └──────────────────────────────────────────────> stellar.expert (cada paso enlaza su transacción)
```

- **Modo mock / testnet** (`ANTICRETICO_MODE`): la API responde igual en los dos modos (`docs/CONTRATO-API.md`). En mock las transacciones son simuladas (`mock_…`); en testnet son reales.
- **Firma en testnet:** el backend firma con las llaves de las cuentas de la demo (custodial, solo testnet). En producción cada usuario firma con su wallet Pollar.

## Contrato `utama-folios` (Soroban)

- ID en testnet: `CB5Y3C72ZQCUUVYK45JHBZWZFRL3UED4OX2BBQOVMTORMWLIPRTBGYAK` ([stellar.expert](https://stellar.expert/explorer/testnet/contract/CB5Y3C72ZQCUUVYK45JHBZWZFRL3UED4OX2BBQOVMTORMWLIPRTBGYAK)).
- Admin (verificador): `GBDWANXM4JOSGNGNBK6SU4J47VCUQ2LLVDKQVIVTWSZJPHTVWD4C6266`.
- Funciones: `atestar_folio(folio, dueno)`, `bloquear(folio, inquilino, escrow, vence)`, `liberar(folio, motivo)`, `liberar_vencido(folio)`, `consultar(folio)`.
- Errores: 1 FolioNoAtestado · **2 FolioOcupado (doble anticrético)** · 3 FolioLibre · 4 PlazoInvalido (más de 5 años, art. 1435 del Código Civil) · 5 TodaviaVigente · 6 InquilinoEsDueno.
- El folio se identifica por `sha256(matrícula normalizada)`: no se guardan nombres, montos ni la matrícula.
- 14 tests (`cd contracts && cargo test`). Detalle y cuentas: `contracts/DEPLOY.md`.

### `utama-folios-v2` (fase 2, multifirma 2 de 3)
- ID en testnet: `CCAHDTXFSPIMB5HFVIKWRODHYKCM4NZ4ES23T4QBSLBO2Q3LT7K2SSCI`. Sin admin único: 3 verificadores, umbral 2, rotación (`agregar_verificador`, `quitar_verificador`, `cambiar_umbral`). Detalle: `contracts/utama-folios-v2/README.md`.
- La API lo usa con `FOLIOS_VERSION=2` (por defecto 1): `atestar_folio`, `bloquear` y `liberar` llevan `firmantes` como 1.er argumento; el VERIFICADOR paga y firma, y `STELLAR_SECRET_VERIF_2` firma su entrada de autorización (`api/src/stellar/multifirma.ts`, mismo mecanismo que `scripts/smoke-multisig.ts`). Error nuevo: `#7` → 502 `FIRMAS_INSUFICIENTES`.
- Cambiar de versión: hacer `POST /demo/reset` y volver a atestar los folios del seed en el contrato nuevo (`cd api && npm run atestar:seed` con `FOLIOS_VERSION=2`); los folios bloqueados en el v1 no pasan al v2.

## Escrow (Trustless Work V2, multi-release)

| Hito | Receptor | Se libera cuando |
|---|---|---|
| 0 · monto − garantía − comisión | dueño | el verificador confirma la inscripción en DDRR |
| 1 · comisión Utama (1 %) | tesoro de Utama | junto con el hito 0 |
| 2 · garantía (10-20 %) | inquilino | check-out, después de que el dueño devolvió el capital |

- Sin inscripción en el plazo: disputa → el mediador resuelve a favor del inquilino → `liberar(Cancelado)`.
- Roles separados (exigencia de Trustless Work): verificador (aprueba y libera), tesoro (plataforma, despliega, abre disputas), admin de TW, mediador (resuelve disputas).
- Trustless Work cobra 0,3 % por liberación; los montos netos se muestran en la app.

## Orden de operaciones al tomar un anticrético
1. Simular `bloquear` en `utama-folios` → si el folio está ocupado, se rechaza **en la cadena** (409 `FOLIO_OCUPADO`).
2. Chequeo en la base de datos (solo atrapa carreras).
3. Desplegar el escrow vacío (Trustless Work).
4. `bloquear` el folio on-chain apuntando a ese escrow.
5. El inquilino deposita (fund).

Cada paso se guarda (`paso`) para poder reintentar sin repetir el depósito.

## Moneda y escala
USDC de Circle en testnet (`GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`). Como el faucet entrega pocos USDC, la demo usa **escala 1:10.000** (`DEMO_ESCALA`, regla del plan con menos de 60 USDC de testnet): un anticrético de 30.000 en pantalla mueve 3 USDC reales. `GET /config` devuelve la escala vigente.

## Real y simulado

| Real (testnet) | Simulado o declarado |
|---|---|
| Contrato `utama-folios`, bloqueo del folio y rechazo del doble anticrético | Verificación del Folio Real (no hay integración con Derechos Reales; la hace el verificador de la demo) |
| Escrow de Trustless Work, depósito, liberación de hitos, reembolso por disputa | Llaves de los usuarios demo guardadas en el backend (custodial, solo testnet) |
| Pagos USDC (devolución, fondeo de wallets Pollar, tarifa de verificación) | Montos a escala 1:10.000 |
| Login y wallet con Pollar | Conversión bolivianos ↔ USDC |

## Cómo correrlo
```bash
docker compose up -d db                                   # Postgres en :5440
cd api && npm install && npx prisma db push && npm run seed
ANTICRETICO_MODE=mock npm run start:dev                   # API en :3001 (o testnet con api/.env.testnet)
cd ../web && npm install && npm run dev                   # web en :3000
```
Testnet desde cero: `bash scripts/setup-cuentas.sh && bash scripts/deploy-folios.sh && bash scripts/exportar-env.sh`.
Tests: `cd contracts && cargo test` · `cd api && npx vitest run` · `STELLAR_IT=1 npx vitest run src/stellar/folios.client.it.spec.ts` (integración real).
