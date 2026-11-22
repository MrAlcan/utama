# Revisión de seguridad — `utama-folios` (F2-9)

Alcance: `contracts/utama-folios/src/lib.rs` (197 líneas) y `test.rs`. `cargo test`: 14/14 pasan. Revisión manual, sin auditoría externa.

## Hallazgos

| ID | Sev. | Descripción | Escenario concreto | Recomendación |
|---|---|---|---|---|
| H-01 | Alta (mainnet) / Baja (testnet) | Admin único (VERIFICADOR), sin rotación ni upgrade ni pausa. `Clave::Admin` se fija en el constructor y no hay función para cambiarla (lib.rs:117, 190). | Se filtra la llave S… del VERIFICADOR: el atacante atesta folios ajenos, bloquea y libera a voluntad. Si se pierde, el contrato queda inutilizable y no se puede corregir. | Mainnet: `proponer_admin`/`aceptar_admin` (2 pasos), multisig (F2-10) como admin, función `pausar`. Requiere redeploy. |
| H-02 | Media | `liberar` no comprueba el estado del escrow (lib.rs:170). El contrato confía por completo en el admin. | Con fondos retenidos en el escrow, un admin comprometido o con error libera el folio y se puede bloquear de nuevo: doble anticrético. | Aceptable en demo (custodial declarado). Mainnet: exigir además la firma del inquilino o un plazo/condición, o que el admin sea multisig. Redeploy. |
| H-03 | Media | `atestar_folio` sobre un folio `Libre` puede cambiar el `dueno` sin consentimiento del dueño anterior ni del nuevo (lib.rs:122-140). El evento no incluye el dueño previo. | Admin atesta el mismo folio con otro `dueno`: transferencia silenciosa de titularidad on-chain. | Registrar `dueno_anterior` en el evento o rechazar re-atestado si cambia el dueño (exigir paso por una función explícita `cambiar_dueno`). Redeploy. |
| H-04 | Media | TTL: el bloqueo puede durar hasta 1827 días, pero `extend_ttl` a `max_ttl` solo ocurre en escrituras (lib.rs:94-99). `consultar` no extiende. El `max_ttl` de red (~6 meses en mainnet) es menor que el plazo máximo. | Folio bloqueado a 5 años sin escrituras: la entrada se archiva. Las lecturas y `liberar_vencido` fallan hasta restaurarla (restore es público, sin pérdida de datos). | No se pierde el bloqueo: Soroban archiva, no borra, y no permite crear una entrada nueva con la misma clave mientras esté archivada, así que no se puede re-atestar un folio expirado para saltarse el bloqueo. Mitigación operativa: job que haga `extend_ttl`/restore periódico (el backend), y documentarlo. Se podría añadir `extender_ttl(folio)` público (sin redeploy no). **Mitigado en el backend (fase 2, `dev1/fase2-e`):** `FoliosClient.extenderTtl` + `TtlService` (diario con `TTL_AUTO=1`, o `POST /api/folio/ttl/procesar`) extiende con `ExtendFootprintTTL` la instancia y los folios atestados que vencen en menos de `TTL_UMBRAL_LEDGERS`; informa los archivados (`sinEntrada`) para `stellar contract restore`. |
| H-05 | Baja | `escrow` es una `Address` cualquiera, no se valida que sea un contrato de Trustless Work real ni que esté fondeado (lib.rs:142-168). | Admin bloquea con un escrow falso: el folio queda bloqueado sin dinero detrás. | Es decisión de diseño (el backend verifica). Mitigar con el orden fijo del backend (deploy escrow → bloquear → fund) y verificación on-chain desde el backend. Mainnet: considerar cross-contract call a lectura del escrow. Redeploy. |
| H-06 | Baja | Carreras simular/bloquear. Solo el admin puede escribir, así que no hay front-running por terceros. | Dos peticiones del backend para el mismo folio: ambas simulan OK; la segunda `bloquear` falla con `FolioOcupado` (código 2) en cadena. | Bien resuelto por diseño: la cadena es el árbitro. El backend debe mapear el error 2 a `FOLIO_OCUPADO onchain:true` y no reintentar. Añadir un mutex por folio en el backend para evitar escrow huérfano (deploy escrow ya hecho cuando falla el bloqueo). **Ya cubierto en el backend:** el contrato se inserta en `CREANDO` (estado vigente) en una transacción `Serializable` que rechaza un 2.º vigente del mismo folio *antes* del deploy del escrow (`contratos.service.ts`, `insertar`); la 2.ª creación recibe 409 `FOLIO_OCUPADO` sin gastar nada. |
| H-07 | Baja | `liberar_vencido` no exige auth (lib.rs:175-184). | Cualquiera la llama: solo libera si `now > vence + 30 días`, y sale por `soltar` con `Finalizado, por_vencimiento=true`. No hay robo posible; el único efecto es liberar el folio vencido. | Intencional y correcto. Nota: libera aunque el escrow siga con fondos sin liberar tras la gracia; documentar. |
| H-08 | Baja | Sin plazo mínimo: `vence > now` basta (lib.rs:158). | `vence = now + 1` bloquea un segundo; tras `vence + 30 d` es liberable por cualquiera. Sin riesgo de fondos, pero permite spam de bloqueos del admin. | Opcional: `MIN_PLAZO` (p. ej. 1 día). Redeploy. |
| H-09 | Info | Overflow de tiempos: `now + MAX_PLAZO` (lib.rs:158) y `vence + GRACIA` (lib.rs:180) son `u64`. `now` es del ledger y `vence <= now + MAX_PLAZO` está acotado (~1.6e8 s), así que no desborda en la práctica. En release se compila con `overflow-checks` solo si está en el perfil. | Un `vence` en `u64::MAX` es rechazado por PlazoInvalido antes de sumar `GRACIA`. | Usar `saturating_add`/`checked_add` por higiene y verificar `overflow-checks = true` en `[profile.release]`. |
| H-10 | Info | Eventos incompletos: `FolioLiberado` no incluye inquilino/escrow liberados ni quién libera; `FolioAtestado` no incluye `atestado_en`. | Un indexador debe reconstruir el contexto desde el evento de bloqueo anterior. | Añadir `inquilino` y `escrow` al evento de liberación (cambia el esquema: redeploy y actualizar el indexador/API). |
| H-11 | Info | Sin consentimiento del dueño/inquilino on-chain: nunca se hace `require_auth` de `dueno` ni de `inquilino`. | El admin puede atestar a nombre de cualquier dueño. | Modelo custodial declarado. Mainnet: pedir firma del dueño en `atestar_folio` o `bloquear`. Redeploy. |
| H-12 | Info | Constructor sin auth (lib.rs:117). | Soroban ejecuta `__constructor` atómicamente en el deploy, sin ventana de front-run. | Nada que hacer. |

## Qué está bien hecho

- `require_auth` del admin en `atestar_folio` (lib.rs:123), `bloquear` (:149) y `liberar` (:171); `liberar_vencido` pública pero acotada por tiempo (:180).
- Doble anticrético imposible por contrato: `bloquear` exige `Libre` (:151) y falla con `FolioOcupado=2`; `atestar_folio` no puede pisar un folio `Bloqueado` (:125); cubierto en tests t05 y t11.
- Validaciones: `inquilino != dueno` (:154), `vence > now` y `vence <= now + 1827 d` (:158); límites cubiertos en t07 y t08.
- `soltar` resetea `inquilino`, `escrow` y `vence` (:106-109) y no permite liberar un folio `Libre` (:103).
- `extend_ttl` en cada escritura persistente y de instancia (:94-99, :119).
- Eventos con `#[contractevent]` y `#[topic]` en el folio (:47-69); códigos de error estables (:9-19).
- Escrituras de estado antes del evento y sin llamadas externas: no hay reentrancia posible.
- `no_std`, sin `unwrap` salvo el admin del constructor garantizado (:83).

## Antes de mainnet

| Cambio | Requiere redeploy |
|---|---|
| Admin como cuenta multisig (F2-10): solo cambia la cuenta pasada al constructor | Sí, el admin actual no se puede cambiar; si aún no hay mainnet, desplegar ya con el multisig |
| Rotación de admin en 2 pasos (`proponer_admin`/`aceptar_admin`) | Sí |
| Función de upgrade (`update_current_contract_wasm`, solo admin, preferible con timelock) | Sí (se añade una vez, luego no hace falta redeploy) |
| Pausa de emergencia (`pausar`/`reanudar`) que bloquee `atestar`/`bloquear` | Sí |
| `extender_ttl(folio)` público y job de mantenimiento en el backend (restore + extend) | La función sí; el job no |
| Firma de dueño/inquilino, evento con dueño previo, validación del escrow, plazo mínimo, `checked_add` | Sí |
| Llave del VERIFICADOR en HSM/KMS, no en `.env`; rotación de llaves; monitoreo de eventos `FolioLiberado` inesperados | No |
| Auditoría externa y prueba con `max_ttl` real de red | No |

## Tests que demostrarían hallazgos (no agregados)

- H-02: bloquear, luego `liberar(Cancelado)` con admin, luego `bloquear` otra vez con otro inquilino: pasa. Demuestra que el contrato no protege contra el admin.
- H-03: `atestar_folio(f, A)` y luego `atestar_folio(f, B)` con el folio `Libre`: `consultar(f).dueno == B`.
- H-04: avanzar el ledger más allá del TTL del folio (`env.ledger().set(... sequence_number += max_ttl+1)`) y comprobar que `consultar` devuelve `None` o falla en el test env; luego verificar que `atestar_folio` sobre esa clave no se puede usar para saltarse el bloqueo en red real (el test env no emula el archivado fielmente: probar en testnet).
- H-08: `bloquear` con `vence = now + 1` devuelve Ok.
- H-09: `bloquear` con `vence = u64::MAX` devuelve `PlazoInvalido` sin pánico.
