# utama-folios-v2 (multifirma M-de-N)

Contrato NUEVO (F2-10). El v1 (`utama-folios`, el de la demo) queda intacto.

## Diseño
- `__constructor(verificadores: Vec<Address>, umbral: u32)`: 1 <= umbral <= len <= 10, sin duplicados. Guardado en instance storage.
- Toda operación privilegiada recibe `firmantes: Vec<Address>` como primer argumento: cada uno debe ser verificador, sin repetidos, se le exige `require_auth()` y `firmantes.len() >= umbral`.
- `liberar_vencido` y `consultar` siguen públicas.

## Funciones
`atestar_folio(firmantes, folio, dueno)`, `bloquear(firmantes, folio, inquilino, escrow, vence)`, `liberar(firmantes, folio, motivo)`, `liberar_vencido(folio)`, `consultar(folio)`, `agregar_verificador(firmantes, nuevo)`, `quitar_verificador(firmantes, viejo)`, `cambiar_umbral(firmantes, umbral)`, `verificadores()`, `umbral()`.
Eventos: `FolioAtestado`, `FolioBloqueado`, `FolioLiberado`, `VerificadorAgregado`, `VerificadorQuitado`, `UmbralCambiado`.

## Errores
1 FolioNoAtestado, 2 FolioOcupado, 3 FolioLibre, 4 PlazoInvalido, 5 TodaviaVigente, 6 InquilinoEsDueno (iguales al v1); 7 FirmasInsuficientes, 8 NoEsVerificador, 9 FirmanteRepetido, 10 ParametrosInvalidos, 11 DuenoDistinto.

## Hallazgos de SEGURIDAD.md
- H-01: set de verificadores con rotación y umbral cambiable (sin admin único). H-02 y H-11 mitigados parcialmente (hace falta quórum para liberar).
- H-03: re-atestar con otro dueño -> `DuenoDistinto`; mismo dueño es idempotente.
- H-09: `checked_add` en vencimiento y gracia.
- Sin cambios: H-04 (TTL), H-05, H-06, H-08, H-10.

## Despliegue (ejemplo, no ejecutado)
```
stellar contract build
stellar contract deploy --wasm target/wasm32v1-none/release/utama_folios_v2.wasm \
  --source <CUENTA_DEPLOYER> --network testnet \
  -- --verificadores '["G...V1","G...V2","G...V3"]' --umbral 2
```
Notas: los firmantes deben firmar la autorización de la invocación (multi-auth); el backend necesitaría las llaves de al menos `umbral` verificadores y pasar `firmantes` en cada llamada.

## Desplegado en testnet (22 nov 2026, redeploy con cuentas nuevas)
- v1 `CB5Y3C72ZQCUUVYK45JHBZWZFRL3UED4OX2BBQOVMTORMWLIPRTBGYAK` · v2 `CCAHDTXFSPIMB5HFVIKWRODHYKCM4NZ4ES23T4QBSLBO2Q3LT7K2SSCI` (2 de 3: utama-verificador `GCDWZEFK…PXPF`, utama-verif-2 `GA3STUZI…VOG6`, utama-verif-3 `GDRCYLU4…2YN3`). IT real v1+v2+TTL OK.

## Desplegado en testnet (21 nov 2026, cuentas perdidas)
- ID: `CB7XOVJBAAIZ5LZIY47Y3GMEDRA5QMVEF5ZZ7N7XESYFJYGLTYNE7QQF` (alias `utama-folios-v2`), umbral **2 de 3**.
- Verificadores: `GBDWANXM4JOSGNGNBK6SU4J47VCUQ2LLVDKQVIVTWSZJPHTVWD4C6266` (utama-verificador), `GAMY7F3T5WKQMMAFZQBUQ56GV7GJFC67DBMPNQDKWBBSX2RLEUSYDLUM` (utama-verif-2), `GBVEEX6HYQ3RYLWGDSJBDQCMMG7WVHYYCKCRLQEE2UWMPBRHK2KKGSJX` (utama-verif-3).
- Prueba real: `cd api && npx tsx ../scripts/smoke-multisig.ts` → 1 firma rechazada on-chain (#7), atestar [V1,V2], bloquear [V2,V3], liberar [V1,V3] OK.
  Firma multi-cuenta con `contract.Client` + `signAuthEntries` (SDK 17); construir la auth a mano dio `Error(Auth, InvalidAction)`.
- La demo del 22 sigue con el v1 (`CDCH7Z…`). Para pasar el backend al v2: los métodos reciben `firmantes` y el backend firma con 2 llaves (pendiente, después del 22).
