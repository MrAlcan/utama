# Vaquita: plan de devolución del dueño (fase 2)

Contrato pool en testnet: `CDKCKHTRKFJXVKLICHPIXAPLIVDRBDQEEGJYDKFOTUV35APVNOGTWZW7`.
Idea: el dueño deposita en Vaquita (ahorro con bloqueo) para juntar y devolver el anticrético.

## Hallazgos (solo lectura)
Fuentes: `stellar contract info interface`, `stellar contract read --durability persistent`, simulaciones con `stellar contract invoke --send=no`, y el repo público `vaquita-labs/stellar` (rama `main`).

| Pregunta | Respuesta |
|---|---|
| Token del pool | `BlendToken` = `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU`, `symbol()` = `USDC`, `name()` = `USDC:GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56`, 7 decimales. **No es el USDC de Circle** (`GBBD47IF…`, SAC `CBIELTK6…`): es el USDC de Blend testnet. |
| Períodos habilitados | Solo `604800` s (7 días) (`SupportedLockPeriod(604800)`). `get_period_data(604800)` = `{ reward_pool: 0, total_deposits: 341000000 }`. Otros períodos fallan con `InvalidPeriod` (solo el admin `GDFF477U…` puede `add_lock_period`). |
| `deposit_id` | En el contrato DESPLEGADO es un `String` libre que elige quien llama (hay posiciones como `12345`, `123456`, hex de 32 chars). No hay nonce on-chain ni whitelist de depositantes. Riesgo: cualquiera puede ocupar un id (por eso usamos `utama-<contratoId>-<n>`). |
| Mínimo | El contrato solo exige `amount > 0` (en la versión de `main`). La API de Vaquita impone `MIN_USDC_AMOUNT = 0.1` USDC; lo replicamos. |
| Flujo del depósito | `deposit` hace `token.transfer(caller -> pool)` y lo invierte en un vault DeFindex; requiere la firma (`require_auth`) de `caller` sobre el token. |

Diferencia importante: el código de `main` (`contracts/vaquita-pool`) es una versión NUEVA: `deposit(caller, nonce: u64, amount, period)` con id derivado `sha256(caller || nonce)`; el contrato desplegado en testnet es la versión ANTIGUA con `deposit_id: String` y `initialize(admin, blend_token, pool_address, defindex_vault_address, lock_periods)`. Nuestro cliente apunta a la interfaz desplegada. Si Vaquita redespliega, hay que cambiar `prepararDeposito` (id `u64`).

## Qué implementamos
- `api/src/stellar/vaquita.client.ts`: `consultarPosicion`, `periodo` (simulación) y `prepararDeposito` (simula y devuelve XDR sin firmar; no envía). Config: `VAQUITA_CONTRACT_ID`.
- `GET /vaquita/posicion/:depositId` y `POST /contratos/:id/vaquita/deposito-xdr` (ver `docs/CONTRATO-API.md`, fase 2). El dueño firma el XDR con Pollar.

## Qué falta / sin confirmar
1. **Token distinto**: el dueño necesita USDC de Blend testnet (`CAQCFVLO…`) con trustline al emisor `GATALT…`, no el USDC de Circle del escrow. Habría que fondear la wallet del dueño con ese token (faucet de Blend) para una demo real.
2. Solo hay un período (7 días); la API acepta cualquier `periodo`, pero otro valor fallará en la simulación (`ONCHAIN_ERROR`).
3. No verificamos que `withdraw` y el rendimiento funcionen (no se gastó nada). No hay retiro en nuestra API todavía.
4. Sin confirmar: si el contrato desplegado reemplazará su interfaz por la de `main`; si el vault DeFindex del testnet tiene liquidez.
5. La API no autentica al llamador: «solo el dueño» se aplica usando la wallet del dueño del contrato como `caller`; quien firme es quien la controle.

## Mensaje para el equipo de Vaquita
> Hola, somos Utama (anticréticos verificados en Bolivia sobre Stellar). Queremos que el dueño ahorre en su pool para devolver el anticrético y llamamos directo al contrato `CDKCKHTR…TGWZW7` en testnet. Dudas: (1) el contrato desplegado usa `deposit(caller, deposit_id: String, …)` mientras `main` usa `nonce: u64`; ¿cuál es la interfaz vigente y se va a redesplegar? (2) El token es el USDC de Blend (`CAQCFVLO…`): ¿hay faucet o podrían habilitar también el USDC de Circle testnet (`CBIELTK6…`)? (3) ¿Pueden habilitar períodos adicionales (p. ej. 30 y 90 días) con `add_lock_period`? (4) ¿Algún mínimo o whitelist de integradores además del mínimo de 0,1 USDC de su API? Gracias.
