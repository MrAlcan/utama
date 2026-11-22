# Plan de Aceptación — Utama (Entrega 1 · Stellar Testnet)

Documento de criterios de aceptación funcionales y manuales para validar el flujo completo de Utama en **Stellar Testnet** (con escala de demo `1:1000`: 30.000 USDC en pantalla = 30 USDC de Circle en testnet).

> **Nota sobre comisiones:** Todos los montos liberados desde el escrow de Trustless Work se validan considerando la comisión de infraestructura de escrow (~`0,30 %` por liberación) y la comisión de Utama (`1 %` solo al confirmarse la inscripción en DDRR).
>
> **Enlaces en stellar.expert (testnet):**
> - Transacción: `https://stellar.expert/explorer/testnet/tx/<hash>`
> - Contrato: `https://stellar.expert/explorer/testnet/contract/<C...>`
> - Cuenta: `https://stellar.expert/explorer/testnet/account/<G...>`

---

## 1. Escenarios de Aceptación (AT-00 a AT-10)

### AT-00 · Demo reiniciable
- **Given** el despliegue público en modo `testnet` y las cuentas demo con XLM y USDC
- **When** se ejecuta el reinicio de la demo (`POST /demo-reset` desde el botón ↺ del encabezado)
- **Then** los inmuebles vuelven al estado inicial, los folios de demo quedan libres on-chain (`consultar` = libre) y la portada muestra el banner de Testnet. Un segundo clic inmediato responde `429` (`RESET_ENFRIAMIENTO`) con el aviso *"Alguien reinició la demo hace poco. Prueba en 2 minutos."*

### AT-01 · Verificación del folio
- **Given** Carlos en **Publicar** con un folio con hipoteca
- **When** solicita la verificación
- **Then** se rechaza con un motivo legible y **no** se envía ninguna transacción.
- **Given** un folio limpio y aprobado
- **When** se publica el inmueble
- **Then** muestra la insignia **Folio verificado** con enlace a `atestar_folio` en `stellar.expert` (en testnet).

### AT-02 · Visita y oferta (off-chain)
- **Given** María viendo un inmueble disponible
- **When** agenda una visita y envía una oferta que Carlos acepta
- **Then** se revela la dirección exacta y el botón **Tomar en anticrético** queda habilitado sin requerir transacción on-chain.

### AT-03 · Tomar en anticrético (camino feliz, parte 1)
- **Given** la oferta aceptada por `30.000 USDC`, `24 meses`, garantía `15 %`
- **When** María pulsa **Firmar y pagar**
- **Then** se registran las 3 transacciones on-chain (bloqueo de folio, creación del escrow y depósito), cada una con enlace **"Ver en stellar.expert ↗"** en el historial;
- **And** el escrow retiene `30.000 USDC` (a escala `1:1000`) y **Carlos todavía no recibe nada** (`Pagado al dueño: 0 USDC`);
- **And** el contrato entra en estado `PENDIENTE_INSCRIPCION` (*"Esperando inscripción"*) con el bloque de pasos DDRR y fecha límite.

### AT-04 · Doble anticrético rechazado on-chain
- **Given** el folio bloqueado por María (AT-03)
- **When** Diego intenta tomar el mismo inmueble
- **Then** la UI muestra la caja **"Rechazado por el contrato en Stellar"** indicando que el contrato `utama-folios` lo bloqueó (`FOLIO_OCUPADO`), con enlace al contrato en `stellar.expert`;
- **And** no se crea ningún escrow ni se descuenta USDC de Diego.

### AT-05 · Inscripción confirmada (camino feliz, parte 2)
- **Given** el contrato en `PENDIENTE_INSCRIPCION`
- **When** la **Verificadora Utama** sube el folio actualizado y pulsa **Confirmar inscripción** (desde `/verificador` o `/contratos/:id`)
- **Then** el contrato pasa a `ACTIVO`, el historial agrega los eventos con enlace a `stellar.expert`, Carlos recibe `25.200 USDC` (± fee TW), el tesoro `300 USDC` y `4.500 USDC` quedan como garantía.

### AT-06 · Sin inscripción → cancelación y reembolso
- **Given** un segundo inmueble tomado por Diego en `PENDIENTE_INSCRIPCION`
- **When** la verificadora pulsa **Cancelar y reembolsar**
- **Then** el estado pasa a `CANCELADO` (*"Cancelado · reembolsado"*), Diego recupera su depósito (menos `0,3 %` de infraestructura de escrow), el dueño y Utama reciben `0`, el folio se libera on-chain y el inmueble vuelve a estar disponible.

### AT-07 · Check-out y cierre
- **Given** el contrato de María en `ACTIVO` con inventario de check-in firmado
- **When** Carlos inicia el check-out, pulsa **Devolver 25.500 USDC**, y la verificadora pulsa **Liberar garantía y cerrar**
- **Then** el contrato pasa a `FINALIZADO`, la garantía (`4.500 USDC`) se libera hacia María, el folio queda libre on-chain (`liberar(hash)`) y el inmueble puede volver a tomarse.

### AT-08 · Plazo ilegal (art. 1435 Código Civil)
- **Given** un intento de bloqueo con plazo superior a 5 años
- **When** se invoca `bloquear` en `utama-folios`
- **Then** el contrato Soroban rechaza la operación (verificado en `cargo test` por Dev-1).

### AT-09 · Enlaces y honestidad
- **Given** cualquier pantalla con transacciones on-chain
- **Then** los enlaces abren `stellar.expert/explorer/testnet` y las transacciones existen;
- **And** no existe copy engañoso (`"al instante"`, `"100 %"`, `"automático"`, `"nadie puede mover"`, ni `"0,5 %"` / `"referencial"` en la comisión).

### AT-10 · Evaluador externo
- **Given** una persona que prueba Utama desde teléfono (375 px) siguiendo el README
- **Then** puede completar AT-03 y AT-04 sin ayuda, con el selector de usuarios, banner, enlaces de menú y botón Pollar visibles en el menú móvil.

---

## 2. Checklist Manual de UI (M1–M13)

| ID | Verificación | Estado |
|---|---|---|
| **M1** | Publicar: sin "alquiler con garantía" ni "mixto"; folio con hipoteca rechazado, limpio verificado | [ ] |
| **M2** | Ficha inmueble: modal muestra nota de retención hasta DDRR (menos 0,3 % TW) y "Comisión Utama 1 %" | [ ] |
| **M3** | María toma anticrético (30.000): entra en "Esperando inscripción", con eventos y reparto sin pago al dueño | [ ] |
| **M4** | Verificadora Utama: `/verificador` lista el contrato de María; otros usuarios ven el aviso de acceso | [ ] |
| **M5** | Verificadora confirma inscripción: pasa a `ACTIVO`, "Pagado al dueño" actualizado, nuevo evento | [ ] |
| **M6** | Diego intenta el mismo inmueble: caja "Rechazado por el contrato en Stellar". Bonus: cancelar → `CANCELADO` | [ ] |
| **M7** | Check-in → dueño inicia check-out → "Devolver" → verificadora "Liberar garantía y cerrar" → `FINALIZADO` | [ ] |
| **M8** | (Testnet) Abrir 3 enlaces de `stellar.expert`: las transacciones existen | [ ] |
| **M9** | Contrato tiene exactamente 5 pestañas (`#cambios` y `#documentos` abren Resumen); sin copy prohibido | [ ] |
| **M10** | Pollar: login con Google, aparece wallet, `GET /usuarios` crece en 1 y wallets demo no cambian | [ ] |
| **M11** | Usuario Pollar ve botón "Firmar y pagar" deshabilitado con el aviso de próxima entrega | [ ] |
| **M12** | (Si aplica W-14) Pago de verificación con Pollar y enlace a `stellar.expert` | [ ] |
| **M13** | Vista móvil (375 px): selector, botón Pollar, enlaces nuevos y banner visibles | [ ] |
