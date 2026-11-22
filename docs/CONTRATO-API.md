# Contrato de la API de Utama (v1 · congelado el 21 nov 2026)

Acuerdo entre backend (Dev-1), frontend (Dev-2) y páginas públicas (Dev-3). **La API responde igual en modo mock y en modo testnet** (`ANTICRETICO_MODE`): en mock los `txHash` empiezan con `mock_` y no hay enlaces al explorador. Cambios a este documento: solo el Dev-1, avisando a los demás.

Prefijo de todas las rutas: `/api`. Ejemplos de respuestas en `docs/fixtures/`.

## 1. Tipos

```ts
type EstadoContrato =
  | 'CREANDO'                // el backend está haciendo las tx on-chain (ver `paso`)
  | 'PENDIENTE_INSCRIPCION'  // dinero en el escrow; falta la inscripción en DDRR
  | 'ACTIVO'                 // inscrito: el dueño cobró
  | 'EN_CHECKOUT'
  | 'FINALIZADO'
  | 'CANCELADO'              // sin inscripción: el escrow devolvió el depósito al inquilino
  | 'EN_DISPUTA' | 'RENOVADO'; // legado: no se generan en el flujo nuevo

type Rol = 'INQUILINO' | 'DUENO' | 'AMBOS' | 'VERIFICADOR';

interface Usuario {
  // …campos actuales…
  rol: Rol;
  wallet: string | null;           // G…
  custodia: 'DEMO' | 'POLLAR';     // DEMO: el backend firma por él (testnet). POLLAR: firma su wallet Pollar
}

interface Contrato {
  // …campos actuales (id, inmuebleId, duenoId, inquilinoId, montoUsdc, montoDuenoUsdc, garantiaUsdc,
  //   devueltoUsdc, folioHash, plazoMeses, inicio, vencimiento, modo, onchainId, txHash, eventos…)
  estado: EstadoContrato;
  escrowId: string | null;          // C… del escrow de Trustless Work (null en mock)
  comisionUsdc: number;             // 1 % del monto (hito al TESORO)
  pagadoDuenoUsdc: number;          // 0 hasta la inscripción; luego el neto recibido
  limiteInscripcion: string | null; // ISO: fecha límite para inscribir en DDRR
  paso: string | null;              // último paso on-chain completado (CREANDO)
  firmaPendiente: boolean;          // fase 2: CREANDO + paso FOLIO_BLOQUEADO + inquilino Pollar = espera su firma del depósito; false en el resto
  ultimoError: string | null;       // mensaje del último fallo on-chain (CREANDO)
}

type TipoEvento =
  | 'FOLIO_ATESTADO' | 'ESCROW_CREADO' | 'FOLIO_BLOQUEADO' | 'DEPOSITO'
  | 'INSCRIPCION_CONFIRMADA' | 'HITO_LIBERADO' | 'DISPUTA_ABIERTA' | 'REEMBOLSO'
  | 'DEVOLUCION_PAGADA' | 'GARANTIA_LIBERADA' | 'FOLIO_LIBERADO'
  | string;                          // + los tipos que ya existen (CHECKIN, CALIFICACION, …)

interface Evento { id: string; tipo: TipoEvento; detalle: string | null; txHash: string | null; creadoEn: string }

interface Configuracion {
  tipoCambioBob: number;             // ya existe
  comisionPlataformaPct: 1;          // antes 0.5
  comisionTwPct: 0.3;                // Trustless Work, por liberación
  red: 'mock' | 'testnet';
  escala: number;                    // 10000 en la demo → 30.000 en pantalla = 3 USDC on-chain (1000 → 30 USDC)
  contratoFolios: string | null;     // C… de utama-folios
  usdc: { code: 'USDC'; issuer: string } | null;
  tesoro: string | null;             // G… del TESORO
  tarifaVerificacionUsdc: number;    // tarifa de verificación del folio (monto de pantalla)
}

interface ErrorApi { message: string; codigo: string; onchain?: boolean; paso?: string; traceId?: string; statusCode: number }
```

**Montos:** la API siempre devuelve y recibe montos **de pantalla** (30.000). La escala a la cadena la aplica solo el backend.
**Netos:** `pagadoDuenoUsdc` y los montos de los eventos `HITO_LIBERADO`/`REEMBOLSO`/`GARANTIA_LIBERADA` ya descuentan el 0,3 % de Trustless Work (en mock se simula igual).

## 2. Endpoints nuevos o modificados

| Método y ruta | Body | Respuesta | Errores |
|---|---|---|---|
| `POST /contratos` | igual que hoy + `modo?: 'mock'\|'testnet'` | 201 `Contrato` en `PENDIENTE_INSCRIPCION`, `limiteInscripcion` = hoy + 30 días | 409 `FOLIO_OCUPADO` (`onchain: true` en testnet) · 502 `ESCROW_PASO_FALLIDO` (el contrato queda en `CREANDO`) · 400 `SALDO_INSUFICIENTE` (se revisa antes de gastar nada) · 400 `PLAZO_INVALIDO` (más de 60 meses, art. 1435 CC) |
| `POST /contratos/:id/reintentar` | — | `Contrato` (retoma desde `paso`) | 409 `ESTADO_INVALIDO` · 409 `FIRMA_PENDIENTE` (fase 2: contrato Pollar con `firmaPendiente`; no hay llave para el `fund`) |
| `POST /contratos/:id/deposito/xdr` (fase 2) | `{}` | `{ unsignedXdr, escrowId, montoUsdc }` (`montoUsdc` de pantalla): XDR de `fund` SIN firmar a nombre del inquilino Pollar; la web lo firma y envía con Pollar (`signAndSubmitTx`). En mock: `unsignedXdr: 'mock_xdr_…'` | 409 `ESTADO_INVALIDO` (no hay `firmaPendiente`, o el escrow ya está fondeado) |
| `POST /contratos/:id/deposito/confirmar` (fase 2) | `{ txHash }` | `Contrato` en `PENDIENTE_INSCRIPCION` (`paso: 'FONDEADO'`, evento `DEPOSITO` con ese `txHash`) tras verificar en la cadena que el escrow tiene el total. Idempotente con el mismo `txHash`. En mock acepta cualquier `txHash` no vacío | 400 `TX_REQUERIDO` · 409 `DEPOSITO_NO_CONFIRMADO` (aún no fondeado; no cambia nada, se puede reintentar) · 409 `ESTADO_INVALIDO` |
| `POST /contratos/:id/inscripcion` | `{ verificadorId, docUrl }` | `Contrato` en `ACTIVO` | 403 `NO_ES_VERIFICADOR` · 409 `ESTADO_INVALIDO` |
| `POST /contratos/:id/cancelar` | `{ verificadorId, motivo? }` | `Contrato` en `CANCELADO` | 403 `NO_ES_VERIFICADOR` · 409 `ESTADO_INVALIDO` |
| `POST /contratos/:id/checkout/iniciar` | igual que hoy | `Contrato` en `EN_CHECKOUT` | 409 `ESTADO_INVALIDO` |
| `POST /contratos/:id/devolucion` | `{ montoUsdc? }` (por defecto: monto − garantía − devuelto) | `Contrato` con evento `DEVOLUCION_PAGADA` | 409 `ESTADO_INVALIDO` · 400 `SALDO_INSUFICIENTE` · 400 `MONTO_INVALIDO` (más de lo que falta) |
| `POST /contratos/:id/checkout/aprobar` | `{ verificadorId, danosUsdc? }` (monto de pantalla, 0 ≤ daños ≤ garantía; con daños: disputa del hito [2] + reparto `{dueño: daños, inquilino: garantía − daños}` + liberar folio; eventos `DISPUTA_ABIERTA`, `GARANTIA_LIBERADA`, `FOLIO_LIBERADO`; reanudable por `paso`) | `Contrato` en `FINALIZADO` + `devueltoAlInquilinoUsdc` | 400 `DEVOLUCION_INCOMPLETA` · 400 `DANOS_INVALIDOS` · 403 `NO_ES_VERIFICADOR` |
| `POST /contratos/vencimientos/procesar` | header `x-demo-token` (si existe `DEMO_RESET_TOKEN`) | `{ cancelados: string[], fallidos: [{ id, error }] }`: cancela los `PENDIENTE_INSCRIPCION` con `limiteInscripcion` vencido (motivo «Vencido el plazo de inscripción», `REEMBOLSO` «… por vencimiento»). Idempotente. La tarea automática cada 10 min solo corre con `VENCIMIENTOS_AUTO=1` | 401 `TOKEN_INVALIDO` |
| `GET /contratos/:id/operaciones` (fase 2) | — | `OperacionOnchain[]` ordenadas por `creadaEn`: `{ id, creadaEn, contratoId, tipo ('tw.deploy'\|'tw.fund'\|'tw.approveAndRelease'\|'tw.dispute'\|'tw.resolveDispute'\|'folios.bloquear'\|'folios.liberar'\|'pago'), rol, txHash, estado ('CONFIRMADA'\|'FALLIDA'), error, modo }`. Auditoría de cada tx enviada por el backend (solo testnet; en mock la lista es `[]`) | — |
| `POST /contratos/:id/vaquita/deposito-xdr` (fase 2) | `{ montoUsdc, periodo, n? }` (`montoUsdc` de pantalla; `periodo` en segundos, hoy solo 604800; `n` por defecto 1) | `{ unsignedXdr, depositId }`: XDR de `deposit` en el pool de Vaquita SIN firmar, a nombre del dueño (su `wallet`); `depositId = utama-<contratoId>-<n>`; la web lo firma con Pollar. Solo contratos `ACTIVO` o `EN_CHECKOUT`. En mock: `unsignedXdr: 'mock_xdr_vaquita_…'`. Ver `docs/VAQUITA.md` | 400 `SOLICITUD_INVALIDA` · 400 `MONTO_MINIMO` (< 0,1 USDC reales) · 404 · 409 `ESTADO_INVALIDO` · 409 `SIN_WALLET` · 502 `ONCHAIN_ERROR` · 503 `VAQUITA_NO_CONFIGURADO` |
| `GET /vaquita/posicion/:depositId` (fase 2) | — | `{ depositId, montoUsdc (pantalla), periodo, finalizaEn (unix s), propietario }`; en mock una posición ficticia con `mock: true` | 404 (sin posición) · 503 `VAQUITA_NO_CONFIGURADO` |
| `POST /contratos/reconciliar/procesar` (fase 2) | header `x-demo-token` (si existe `DEMO_RESET_TOKEN`) | `{ revisados, completados, cancelados, errores }`: para los contratos `CREANDO` en modo testnet con más de `RECONCILIAR_MIN` minutos (5) sin actividad llama a `reintentar`; los contratos Pollar con `firmaPendiente` no se reintentan: se cancelan solo si pasan `FIRMA_POLLAR_MIN` minutos (30) desde su creación; si falla con `SALDO_INSUFICIENTE` o tras `RECONCILIAR_MAX_INTENTOS` (3) intentos fallidos, los cancela (motivo «Creación on-chain no completada (reconciliación automática)»). La tarea automática cada 5 min solo corre con `RECONCILIAR_AUTO=1` | 401 `TOKEN_INVALIDO` |
| `GET /contratos?estado=X` | — | `Contrato[]` (filtro nuevo; se combina con `usuarioId`, `inmuebleId`) | — |
| `GET /contratos/:id/onchain` | — | `{ saldoEscrowUsdc, hitos: [{ indice, descripcion, montoUsdc, receptor, liberado }], folioOcupado }` (en mock, calculado desde la BD) | 404 |
| `GET /config` | — | `Configuracion` | — |
| `GET /usuarios` | — | incluye `u-verificador` ("Verificadora Utama", rol `VERIFICADOR`) y `custodia` | — |
| `POST /usuarios` | `{ nombre, email, wallet, rol, paisResidencia }` | si trae `wallet` → `custodia: 'POLLAR'` | 409 si el correo o la wallet ya existen |
| `POST /usuarios/:id/fondear` | — | `{ txHash, montoUsdc }` (USDC de prueba a la wallet Pollar; una vez por usuario) | 409 `YA_FONDEADO` · 409 `WALLET_NO_LISTA` · 400 `NO_ES_POLLAR` |
| `POST /folio/pago` | `{ usuarioId, txHash }` | `{ ok: true }` (pago de la verificación hecho con Pollar; en testnet se verifica en Horizon) | 400 `PAGO_INVALIDO` |
| `GET /folio/:folio/onchain` (fase 2, F2-6) | `:folio` = número de folio (se normaliza y hashea como al publicar) o el hash hex de 64 | `{ folioHash, red, onchain, contrato, atestado, estado: 'Libre'\|'Bloqueado'\|null, dueno, inquilino, escrow, atestadoEn, vence, explorer }` (fechas ISO). En testnet se lee del contrato de folios (`onchain: true`, `explorer` = stellar.expert); en mock se deriva de la BD (`onchain: false`). Público: solo datos que ya están en la cadena | 400 `FOLIO_INVALIDO` · 502 `ONCHAIN_ERROR` |
| `POST /folio/ttl/procesar` (fase 2, H-04) | — (header `x-demo-token` si `DEMO_RESET_TOKEN` está definido) | `{ modo, revisados, extendidos, sinEntrada: string[], txHash }`. En testnet extiende el TTL on-chain de la instancia del contrato y de los folios atestados que vencen pronto (paga el TESORO); en mock no hace nada. Lo mismo corre a diario con `TTL_AUTO=1` | 401 `TOKEN_INVALIDO` · 502 `ONCHAIN_ERROR` |
| `POST /demo/reset` | header `x-demo-token` | `{ ok: true }` (BD + liberar folios on-chain + recarga de saldos) | 401 sin token · 429 `RESET_ENFRIAMIENTO` (2 min entre reinicios) |
| `aportes`, `renovacion/*`, `salida-anticipada`, `disputa*`, `ddrr` (rutas viejas) | — | sin cambios en mock | en testnet: 400 `NO_DISPONIBLE_EN_TESTNET` |

La web **no** llama a `/demo/reset` directamente: usa su route handler `POST /demo-reset` (Next), que agrega el token del lado del servidor.

**Errores genéricos:** cualquier error inesperado responde 500 con `codigo: 'ERROR_INTERNO'`. Los errores viejos también traen `codigo` (p. ej. `NO_ENCONTRADO`). El `modo` del body de `POST /contratos` se ignora: lo decide el servidor (`ANTICRETICO_MODE`).
**Fondeo:** `POST /usuarios/:id/fondear` devuelve `montoUsdc` en monto de pantalla. `POST /demo/reset` también reinicia la marca de fondeo de los usuarios.

## 3. Máquina de estados

```
            crear (mock: directo · testnet: deploy → bloquear → fund)
   ──────────────► CREANDO ──────────────► PENDIENTE_INSCRIPCION ──inscripcion──► ACTIVO ──checkout/iniciar──► EN_CHECKOUT
                     │  ▲ reintentar               │                                                               │
                     └──┘                          └──cancelar──► CANCELADO              devolucion + checkout/aprobar ▼
                                                                                                              FINALIZADO
```
Un folio está **ocupado** mientras su contrato esté en `CREANDO`, `PENDIENTE_INSCRIPCION`, `ACTIVO`, `EN_CHECKOUT` o `EN_DISPUTA`.

## 4. Reparto de montos (ejemplo de 30.000, garantía 15 %, comisión 1 %)
| Concepto | Monto de pantalla |
|---|---|
| Hito 0 → dueño | 25.200 (neto tras 0,3 % TW: 25.124,40) |
| Hito 1 → TESORO (comisión) | 300 (neto: 299,10) |
| Hito 2 → inquilino (garantía) | 4.500 (neto: 4.486,50) |
| Reembolso sin inscripción | 30.000 (neto: 29.910) |
