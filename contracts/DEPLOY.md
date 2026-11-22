# Despliegue de `utama-folios` (testnet)

Fecha: 21 nov 2026. Sin secretos en este archivo (las llaves viven en `~/.config/stellar`; `scripts/exportar-env.sh` las vuelca a `api/.env.testnet`, ignorado por git).

## Contrato
- ID: `CB5Y3C72ZQCUUVYK45JHBZWZFRL3UED4OX2BBQOVMTORMWLIPRTBGYAK` (alias `utama-folios`)
- Explorer: https://stellar.expert/explorer/testnet/contract/CB5Y3C72ZQCUUVYK45JHBZWZFRL3UED4OX2BBQOVMTORMWLIPRTBGYAK
- Admin (= verificador, fijado en `__constructor`): `GBDWANXM4JOSGNGNBK6SU4J47VCUQ2LLVDKQVIVTWSZJPHTVWD4C6266`
- sha256 del wasm: `0a214a5143311b71670b229b06a6997588703979a88c687fe44ffc2b5d7912b6`
- Errores: 1 FolioNoAtestado, 2 FolioOcupado, 3 FolioLibre, 4 PlazoInvalido, 5 TodaviaVigente, 6 InquilinoEsDueno.
- Hash del folio: `sha256(normalizarFolio(matricula))`; vector `7.01.1.99.0012345` y `70119 90012345` -> `7011990012345` -> `6fc1fc68c15a3fc6bf6eea29837c17ad935d7c11cd679236a8075a83b752ac6f`.

## Token
- USDC (Circle testnet), emisor `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- SAC del USDC: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
- Todas las cuentas tienen trustline (saldo 0; faucet: faucet.circle.com, 20 USDC por solicitud).

## Cuentas (solo direcciones publicas)
| Identidad | Direccion |
|---|---|
| utama-verificador | [GBDWANXM4JOSGNGNBK6SU4J47VCUQ2LLVDKQVIVTWSZJPHTVWD4C6266](https://stellar.expert/explorer/testnet/account/GBDWANXM4JOSGNGNBK6SU4J47VCUQ2LLVDKQVIVTWSZJPHTVWD4C6266) |
| utama-tesoro | [GBB3UZBZ4TAUCJDV2LWNUHKCGIFXGQ7AIFXJDLAHFNBXK7SEYBHFIXA5](https://stellar.expert/explorer/testnet/account/GBB3UZBZ4TAUCJDV2LWNUHKCGIFXGQ7AIFXJDLAHFNBXK7SEYBHFIXA5) |
| utama-admin-tw | [GBNYZYU3Z2NTGCVGURAPNBHRTU7ILIBXI7DRTCB2G5EV2ZYWJ43BSKAB](https://stellar.expert/explorer/testnet/account/GBNYZYU3Z2NTGCVGURAPNBHRTU7ILIBXI7DRTCB2G5EV2ZYWJ43BSKAB) |
| utama-mediador | [GDXELBWHVVYFU36XMBB3GSQQXGBDREXFTZ3HQZTSS3ANRMBTXIJNSXNW](https://stellar.expert/explorer/testnet/account/GDXELBWHVVYFU36XMBB3GSQQXGBDREXFTZ3HQZTSS3ANRMBTXIJNSXNW) |
| utama-carlos | [GBI74TSNAV7GYMSAS73ETCBL6V3FQPS4224FATUQBUNZXYJQ6MLTQVWE](https://stellar.expert/explorer/testnet/account/GBI74TSNAV7GYMSAS73ETCBL6V3FQPS4224FATUQBUNZXYJQ6MLTQVWE) |
| utama-lucia | [GDFIVYWUNMSHXKL7MEIYMLXUA3OPSJKCSMJJTV5RJ2M3L3MZBBGIHHAX](https://stellar.expert/explorer/testnet/account/GDFIVYWUNMSHXKL7MEIYMLXUA3OPSJKCSMJJTV5RJ2M3L3MZBBGIHHAX) |
| utama-maria | [GBZSZEBDU2GYVOQBTD5SMB6IW3EFKTPDHQ3BNTYGEMT4S2X64PGJVESY](https://stellar.expert/explorer/testnet/account/GBZSZEBDU2GYVOQBTD5SMB6IW3EFKTPDHQ3BNTYGEMT4S2X64PGJVESY) |
| utama-diego | [GDEJYZHCFIGFDRCJ25APUGLZDQ4Q4EZOUAV7PLKNRGARGIHQOHSYNPMR](https://stellar.expert/explorer/testnet/account/GDEJYZHCFIGFDRCJ25APUGLZDQ4Q4EZOUAV7PLKNRGARGIHQOHSYNPMR) |

## Smoke verificado
`bash scripts/smoke.sh`: atestar -> bloquear (maria) -> 2.o bloquear (diego) rechazado con `Error(Contract, #2)` -> consultar (`Bloqueado`) -> liberar(Finalizado) -> consultar (`Libre`). Los eventos `folio_atestado`, `folio_bloqueado` y `folio_liberado` aparecen en el explorer del contrato.

## Redesplegar / recrear (p. ej. tras un reinicio de testnet)
```bash
bash scripts/setup-cuentas.sh      # idempotente: crea cuentas faltantes + trustline USDC
bash scripts/deploy-folios.sh      # build + deploy; guarda contracts/.folios-contract-id
bash scripts/smoke.sh              # atestar/bloquear/doble bloqueo/consultar/liberar
bash scripts/exportar-env.sh       # escribe api/.env.testnet (secretos, fuera de git)
```
Tests locales: `cd contracts && cargo test` (14 tests) y `stellar contract build`.
Al redesplegar, actualizar el ID en este archivo y `FOLIOS_CONTRACT_ID` en el backend.

## Runbook: contrato atascado en `CREANDO` (X-07)

Al tomar un anticrético en testnet el backend guarda el contrato en `CREANDO` **antes** de la primera tx y avanza `paso`:
`null` → `ESCROW_CREADO` (deploy TW) → `FOLIO_BLOQUEADO` (`utama-folios.bloquear`) → `FONDEADO` (fund del inquilino) → `PENDIENTE_INSCRIPCION`.
Si algo falla a mitad, la API responde 502 `ESCROW_PASO_FALLIDO` y el contrato queda en `CREANDO` con `paso` y `ultimoError`.

1. **Diagnóstico.** `GET /api/contratos/<id>` (`estado`, `paso`, `ultimoError`, eventos con `txHash`) y `GET /api/contratos/<id>/onchain` (estado del folio y saldo del escrow leído on-chain). Revisar los `txHash` en stellar.expert.
2. **Reintentar (primera opción).** `POST /api/contratos/<id>/reintentar`. Retoma desde `paso` sin repetir lo hecho:
   - `ESCROW_CREADO`: consulta el folio; si ya está bloqueado con ese escrow no vuelve a bloquear.
   - `FOLIO_BLOQUEADO`: lee el saldo del escrow on-chain; **nunca fondea dos veces** si ya cubre el total.
   - 400 `SALDO_INSUFICIENTE`: recargar al inquilino (`cd api && npx tsx ../scripts/consolidar-tesoro.ts` y luego `POST /api/demo/reset`, o un pago manual desde el TESORO) y reintentar.
3. **Abortar.** Si no se puede completar: `POST /api/contratos/<id>/cancelar` con `{ "verificadorId": "u-verificador" }`.
   - Con fondos en el escrow (`FONDEADO` o saldo > 0): cancelación completa (disputa del TESORO → resolución del MEDIADOR → reembolso al inquilino → `liberar(Cancelado)`).
   - Sin fondos: solo `liberar(SinFondeo)`, y únicamente si el folio está bloqueado con **ese** escrow (si lo ocupa otro, no se toca).
   - El contrato pasa a `CANCELADO` y el inmueble vuelve a `PUBLICADO`.
4. **Último recurso (demo).** `POST /api/demo/reset` (header `x-demo-token` si `DEMO_RESET_TOKEN` está definido; 429 `RESET_ENFRIAMIENTO` si pasaron menos de 2 min): libera on-chain (`Cancelado`) todos los folios vigentes en la BD, limpia contratos y recarga saldos desde el TESORO. Un escrow huérfano con fondos no se recupera con el reset: resolverlo con el paso 3 antes, o con `npx tsx scripts/tw-smoke.ts` como guía (dispute + resolve).
5. **Si testnet se reinició** (cuentas y contratos borrados): sección "Redesplegar / recrear" de arriba, actualizar `FOLIOS_CONTRACT_ID` y `cd api && npm run atestar:seed`.

Fase 2 (`dev1/fase2*`): `RECONCILIAR_AUTO=1` hace los pasos 2 y 3 solo, cada `RECONCILIAR_MIN` minutos, hasta `RECONCILIAR_MAX_INTENTOS`; el historial de tx queda en `GET /api/contratos/<id>/operaciones`.
