# Utama — Qué funciona, qué es simulado y qué no existe

Estado al 19 de noviembre de 2026, revisado contra el código. Para cada función se indica **qué hace**, **por dónde pasa** (pantalla → API → tablas) y **qué parte es real o simulada**.

**Leyenda:** ✅ funciona de verdad · 🟡 funciona pero con una parte simulada · ⬜ no existe todavía

---

## 1. Lo primero que hay que saber

### Qué es real y qué es simulado en general

| Pieza | Estado | Detalle |
|---|---|---|
| Base de datos, API y pantallas | ✅ real | PostgreSQL + NestJS + Next.js. Todo se guarda y se comparte entre usuarios |
| Reglas del anticrético (reparto, bloqueo del folio, liberación) | ✅ real **en la base de datos** | Las aplica el backend en una transacción serializable |
| **Contrato inteligente en Stellar** | ⬜ no existe | La carpeta `contracts/` no está creada. En modo `mock` el backend hace de contrato |
| Modo `testnet` | ⬜ no funciona | `web/src/lib/anticretico/stellar.ts` lanza el error "falta implementar" |
| Pagos, firmas con wallet y `txHash` | 🟡 simulados | El `txHash` es `mock_…` aleatorio; no se mueve dinero |
| Lectura del Folio Real | 🟡 simulada | Resultado predefinido según el "folio de ejemplo" elegido. El **hash es real** |
| Verificación de identidad | 🟡 simulada | Se suben CI y selfie, pero no se valida nada |
| Conversión Bs ↔ USDC | 🟡 simulada | Tipo de cambio fijo (`TIPO_CAMBIO_BOB`, 9,30 por defecto) |
| Vaquita | 🟡 dato de ejemplo | `ahorroVaquita` viene del seed (María: 1.850 USDC) |
| Pollar / wallet | ⬜ no integrado | La wallet se pega a mano en `Mi panel` |

### Cómo se identifica un usuario
**No hay login.** Se elige un "usuario de demostración" en la barra superior y esa elección se guarda en el navegador. **El backend no comprueba quién llama**: los roles (dueño, inquilino) solo se hacen cumplir en la interfaz. Cualquiera que llame a la API puede actuar como cualquier usuario. Esto lo reemplazaría Pollar.

### Datos de ejemplo (seed)
| Usuario | Rol | Nivel | Residencia |
|---|---|---|---|
| Carlos Mamani | dueño | Oro | BO |
| Lucía Fernández | dueña | Plata | BO |
| María Quispe | inquilina | Bronce (ahorro Vaquita 1.850) | BO |
| Diego Rojas | inquilino | Nuevo verificado | ES |

Cinco inmuebles (departamento y local en Santa Cruz, casa en Cochabamba, oficina en La Paz, galpón en Santa Cruz) con 3 ilustraciones cada uno, y horarios de visita para los próximos 5 días (10:00 y 15:00, hora de Bolivia). El seed se vuelve a ejecutar al arrancar la API y solo repone los horarios y las fotos; no pisa tus datos.

---

## 2. Resumen por módulo del documento de definición

| Módulo | Estado | Nota |
|---|---|---|
| M1 Identidad y cuentas | 🟡 | Registro, país → moneda, rol, verificación simulada. Sin passkeys ni teléfono |
| M2 Verificación de inmuebles | 🟡 | Se suben folio y CI; la lectura es simulada; el hash es real |
| M3 Marketplace | ✅ | Listado, filtros, mapa de inmuebles (disponibles y en anticrético), ficha, insignias, estado |
| M4 Reglas y condiciones | ✅ | 9 categorías × 3 plantillas, sello, y la penalidad de salida se aplica |
| M5 Visitas y calendario | ✅ | Sin recordatorios por correo o SMS |
| M6 Negociación y contrato | 🟡 | Ofertas y contraofertas; resumen. Sin chat ni firma digital propia |
| M7 Pagos y conversión | 🟡 | USDC y bolivianos simulados; reparto real en la BD |
| M8 Contrato inteligente | 🟡 | Mock en el backend. El contrato Soroban está por escribir |
| M9 Check-in, check-out e inventario | ✅ | Con fotos, firmas y hash (el hash no va on-chain todavía) |
| M10 Resolución de conflictos | 🟡 | Daños, salida anticipada, disputa y mediador (cualquiera lo ejecuta) |
| M11 Reputación y niveles | 🟡 | Calificación mutua y niveles automáticos; Vaquita de ejemplo |
| M12 Derechos Reales | ✅ | Guía, carga del folio actualizado e insignia (no se valida el archivo) |
| M13 Agentes | ⬜ | Solo en la hoja de ruta |
| M14 Utama Crédito | ⬜ | Solo en la hoja de ruta |
| M15 Utama Invierte | ⬜ | Solo en la hoja de ruta |
| M16 Notificaciones y paneles | ✅ | Panel y campana; sin envío por correo o push |
| M17 Administración | ⬜ | Solo el botón de reiniciar la demo |

---

## 3. Flujos, uno por uno

Cada flujo usa este formato: **pantalla** → **llamadas a la API** → **tablas que cambia** → **reglas** → **qué es simulado**.

### F1 · Registro y verificación de identidad — 🟡

**Pantalla:** `/registro`

1. El usuario completa nombre, correo (opcional), qué quiere hacer (inquilino, dueño o ambos) y país de residencia.
   `POST /api/usuarios` → crea `Usuario` con `identidadVerificada = false`.
2. La app lo selecciona como usuario actual y pasa al paso 2.
3. Sube la foto de su CI o pasaporte y una selfie (`POST /api/uploads`, imágenes o PDF de hasta 8 MB; en el celular se abre la cámara).
4. `POST /api/usuarios/:id/verificar-identidad` → guarda las dos URLs y pone `identidadVerificada = true`. Empieza como **"Nuevo verificado"**.

**Reglas aplicadas por el backend:** sin identidad verificada **no se puede** publicar un inmueble, tomar un anticrético ni agendar una visita.
**Simulado:** la verificación. No se comprueba que el documento sea real ni que la selfie coincida. **Los archivos se guardan sin cifrar.**
**Falta:** registro por teléfono, passkeys, validar la identidad con IA y revisión humana.

### F2 · Publicar un inmueble — 🟡

**Pantalla:** `/publicar` (solo para dueños con identidad verificada)

1. Datos: título, tipo (casa/departamento, local, oficina, galpón, habitación), tipo de contrato (anticrético, alquiler con garantía, mixto), ciudad, zona, dirección exacta, superficie, dormitorios, baños, amoblado, descripción.
2. Condiciones: monto en USDC, plazo (12, 24 o 36 meses), fondo de garantía (10 a 20 %) y plantilla de reglas. Al elegir plantilla se sugiere la garantía (10, 15 o 20 %) y se muestran las 9 reglas. Casilla de **reglas recomendadas** (da el sello).
3. Documentos: se sube el Folio Real y el documento de identidad (`POST /api/uploads`).
4. **Verificar folio:** `POST /api/folio/verificar` con el número y el "folio de ejemplo". Espera 1,2 s y devuelve el resultado y el **hash SHA-256** del número normalizado (sin puntos, guiones ni espacios, en mayúsculas).
5. **Ubicación en el mapa (obligatoria):** se marca la posición haciendo clic en el mapa, arrastrando el alfiler, con «Usar mi ubicación» (GPS del navegador) o escribiendo la **latitud y la longitud**. El mapa abre en la ciudad escrita (Santa Cruz, Cochabamba, La Paz, El Alto, Sucre, Tarija, Oruro o Potosí). Avisa si la posición cae fuera de Bolivia. El backend rechaza con **400** si faltan las coordenadas o están fuera de rango (latitud −90 a 90, longitud −180 a 180).
6. Fotos desde la cámara (`capture` en el celular). Si no se sube ninguna, se usa una ilustración según el tipo.
7. **Publicar:** `POST /api/inmuebles`. El backend vuelve a verificar el folio y:
   - rechaza con **422** si el folio no está verificado (el mensaje dice el motivo);
   - rechaza con **409** si ese folio ya está registrado en Utama;
   - crea `Inmueble` en estado `PUBLICADO` con sus `Foto`.

**Escenarios del folio simulado:**

| Folio de ejemplo | Resultado |
|---|---|
| Limpio | ✅ Verificado |
| Con hipoteca inscrita | ⛔ Rechazado |
| Con anticrético ya inscrito | ⛔ Rechazado |
| Titular distinto al CI | ⛔ Rechazado |

**Simulado:** la lectura del folio (no se abre ningún documento) y que "el titular coincide con el CI". **Real:** el hash, la unicidad del folio y el rechazo.
**Falta:** lectura con IA, validación por QR, exigir un folio emitido hace menos de 30 días, comprobar que las coordenadas correspondan a la dirección escrita, ubicación y fecha reales de las fotos.

### F3 · Explorar y filtrar — ✅

**Pantalla:** `/`

`GET /api/inmuebles` con los filtros que se elijan: tipo de inmueble, tipo de contrato, ciudad, texto (título, zona o descripción), monto máximo, plazo.
- Solo salen inmuebles `PUBLICADO` o `EN_ANTICRETICO`.
- Orden: primero los de **reglas recomendadas** (más visibilidad), luego los más recientes.
- Cada tarjeta muestra insignias, el precio, el dueño con su nivel y el estado: **"Disponible"** o **"En anticrético hasta [fecha]"** (se lee del contrato vigente).
- **Privacidad:** la respuesta no incluye la dirección exacta ni el número de folio completo (solo `••••2345`).
- **Vista Lista / Mapa:** el botón «Mapa» muestra todos los inmuebles (OpenStreetMap con Leaflet). Alfiler verde azulado = disponible; dorado = **en anticrético**. Al tocar un alfiler aparece una tarjeta con foto, precio, estado y el botón «Ver». Respeta los mismos filtros que la lista. El mapa se ve claro u oscuro según el tema.
- **Ubicación aproximada:** para el público, la API devuelve la posición **desplazada hasta ~200 m** (fija por inmueble, calculada con el id) y el mapa dibuja un círculo de zona. La posición exacta solo se devuelve al dueño, a quien tiene una visita agendada o a quien tiene un contrato (misma regla que la dirección).

**Falta:** agrupar alfileres cercanos (en la vista de todo el país los de una misma ciudad se superponen hasta acercar el mapa), filtro por monto mínimo en pantalla (la API lo admite) y por características.

### F4 · Ver la ficha y la dirección — ✅

**Pantalla:** `/inmuebles/[id]`

`GET /api/inmuebles/:id?usuarioId=…`. La dirección exacta solo se devuelve si el usuario es **el dueño**, **tiene una visita agendada** (confirmada o realizada) o **tiene un contrato** sobre ese inmueble. Para los demás, la ficha dice "se revela cuando agendas una visita".
La ficha muestra un mapa de la ubicación (aproximada con círculo, o exacta con el alfiler si corresponde), galería, datos, insignias, las **reglas pactadas** (por categoría, según la plantilla), el precio con su equivalente en Bs (referencial) y el reparto.

### F5 · Agendar una visita — ✅

**Pantallas:** ficha del inmueble (agenda del inmueble) y `Mi panel` (todas mis visitas)

El calendario tiene cuatro vistas: **Mes** (con los horarios de cada día; al tocar un día se abre esa fecha), **Semana** y **Día** (con las horas, la línea de «ahora» y los horarios que se pisan lado a lado) y **Agenda** (lista por día de los próximos 30 días). Navega con ‹ Hoy ›. Abre en la próxima fecha con horarios. La semana empieza el lunes. En celulares abre en Agenda (inquilino) o Día (dueño), porque la semana no cabe. Las horas se muestran en la zona horaria del navegador.

- **El inquilino** ve los horarios libres (verde azulado), los ya reservados (gris) y los suyos (terracota). Toca uno libre y confirma «Reservar esta visita»: `POST /api/visitas`. Puede cancelar la suya desde el mismo detalle.
- **El dueño** toca una **hora vacía** de la vista Semana o Día para ofrecer una visita de 45 minutos (`POST /api/inmuebles/:id/disponibilidad`); toca un horario libre para quitarlo (`DELETE /api/disponibilidad/:id`) o uno reservado para ver **quién lo reservó** y cancelarlo. Ya no existe el selector nativo de fecha y hora.
- **Mi panel → Mis visitas:** calendario con todas mis visitas (como inquilino, terracota, y como dueño, dorado). Al tocar una se ve el inmueble, la dirección y se puede cancelar.
- `GET /api/inmuebles/:id/disponibilidad?usuarioId=…` devuelve, además de `reservada`, el `visitaId` y `mia` si la visita es del usuario, y `reservadaPor` solo al dueño. Los demás solo saben que está reservado.
- Reglas: el horario no puede ser pasado; **dos horarios del mismo inmueble no pueden cruzarse** (409); no se agenda en el propio inmueble; el usuario debe estar verificado; **dos personas no pueden reservar el mismo horario** (restricción única en la base; la segunda recibe 409).
- Al reservar se revela la dirección exacta y la posición exacta en el mapa.
- Cancelar (`DELETE /api/visitas/:id`) borra la visita y libera el horario.

**Falta:** recordatorios automáticos por correo o SMS (solo aparecen en la campana, 7 días antes), agregar horarios con el teclado (hoy solo se hace tocando el calendario), horarios repetidos (ej. «todos los sábados») y que el dueño confirme o rechace cada visita (hoy se confirman solas).

### F6 · Negociar con ofertas — ✅

**Pantalla:** ficha del inmueble (y `Mi panel`)

1. El inquilino ofrece monto, plazo y un mensaje (`POST /api/ofertas`). No puede ofertar por su propio inmueble.
2. El dueño la **acepta**, la **rechaza** o **contraoferta** con otro monto y plazo (`PATCH /api/ofertas/:id`).
3. El inquilino puede aceptar o rechazar la contraoferta.
4. Si una oferta queda **aceptada**, aparece el botón *"Tomar en anticrético con esta oferta"*, que abre el resumen de pago con esos términos.

**Límites:** aceptar una oferta **no crea el contrato** ni reserva el inmueble (el inquilino tiene que pulsar el botón), y no rechaza las demás ofertas.
**Falta:** chat en vivo, y registrar un acuerdo verbal.

### F7 · Tomar en anticrético (el pago y el bloqueo del folio) — 🟡

**Pantalla:** ficha → ventana "Resumen y pago" → `/contratos/[id]`

1. El resumen muestra las partes, el monto, el plazo, lo que recibe el dueño, el fondo de garantía, la plantilla de reglas y la comisión de Utama (referencial).
2. **Forma de pago:** dólares digitales (USDC) o bolivianos (QR bancario). Se sugiere según la residencia: Bolivia → bolivianos, otro país → USDC. En bolivianos se muestra cuánto se paga (monto × tipo de cambio).
3. **Firmar y pagar** → `anticretico.crearAnticretico(...)` → en modo mock: `POST /api/contratos`.
4. El backend, en **una transacción serializable**:
   - comprueba que el inmueble existe, que el inquilino no es el dueño y está verificado;
   - calcula el reparto: **garantía = monto × % de garantía** (por defecto 15 %) y **al dueño = monto − garantía**;
   - **si ya hay un contrato vigente con ese folio** (`ACTIVO`, `EN_CHECKOUT` o `EN_DISPUTA`) responde **409: "Este inmueble ya tiene un anticrético activo."**;
   - si no, crea el `Contrato`, pasa el inmueble a `EN_ANTICRETICO` y registra el evento `CREADO`.
5. La app abre la página del contrato.

**El momento clave de la demo:** con otro usuario, intentar tomar el mismo inmueble → la ventana muestra "⛔ Operación rechazada por el contrato".
**Simulado:** el cobro (no se mueve dinero), la firma con wallet, el `txHash` y la conversión a bolivianos. **Real:** las validaciones, el reparto y el bloqueo del folio en la base de datos.
**En modo testnet:** hoy falla con un mensaje claro hasta que se implemente `stellar.ts`.

### F8 · Durante el contrato — 🟡

**Pantalla:** `/contratos/[id]`. La página se organiza en una **barra de etapas** (contrato firmado → check-in → vigencia → check-out → cierre), un aviso de **«Próximo paso»** según tu rol y **7 pestañas**: Resumen, Devolución, Inventario, Cambios, Check-out, Derechos Reales e Historial. Cada acción (renovar, salir antes, disputa) es una tarjeta separada dentro de «Cambios».


| Acción | Quién (en la interfaz) | Qué hace en el backend |
|---|---|---|
| **Aportar a la devolución** | dueño | `POST …/aportes`. Solo con el contrato `ACTIVO`; no puede pasar de lo que falta. Suma a `devueltoUsdc` y registra el evento |
| **Ver el plan de devolución** | todos | Barra con la garantía (ocre) y los aportes (verde), % asegurado y lo que falta juntar |
| **Proponer renovación** | dueño o inquilino | `POST …/renovacion/proponer`. Guarda la propuesta (plazo y nota) con la aceptación del que propone |
| **Aceptar renovación** | la otra parte | `POST …/renovacion/aceptar`. Cuando aceptan **ambos**: el vencimiento y el plazo se extienden, `renovaciones` sube y **no hay que devolver ni volver a depositar** |
| **Salida anticipada** | dueño o inquilino | `POST …/salida-anticipada`. Pasa a `EN_CHECKOUT`. Si la pide el **inquilino**, se aplica la penalidad de la plantilla (**Flexible 0 %, Moderada 3 %, Estricta 6 %** del monto, sin pasar de la garantía) y se descuenta de la garantía |
| **Abrir disputa** | dueño o inquilino | `POST …/disputa` con el motivo. Pasa a `EN_DISPUTA` |
| **Resolver disputa (mediador)** | cualquiera (en la demo) | `POST …/disputa/resolver` con un descuento opcional de la garantía. Vuelve a `EN_CHECKOUT` |

**Límites:** si el **dueño** recupera el inmueble antes, no se mueve dinero (la "compensación" solo está escrita en las reglas). El estado `RENOVADO` no se usa: un contrato renovado sigue `ACTIVO`. En modo testnet estas tres acciones (disputa, renovación, salida anticipada) **no tienen función en el contrato Soroban del borrador**; se registran solo en el backend.

### F9 · Check-in e inventario — ✅

**Pantalla:** `/contratos/[id]`

1. Por cada ambiente (sala, cocina, dormitorio principal, baño, pisos y paredes): estado (excelente, bueno, regular, malo), observación y **fotos** (cámara en el celular).
2. **Guardar inventario:** `PUT /api/contratos/:id/inventario/CHECKIN`. Si se vuelve a guardar, **se borran las firmas**.
3. Cada parte **firma** (`POST …/firmar` con `DUENO` o `INQUILINO`). Cuando firman las dos se calcula el **hash SHA-256 del inventario** y se registra un evento.
4. El mismo formulario existe para el **check-out** (`CHECKOUT`) cuando el contrato ya no está activo.

**Límites:** el hash queda en la base de datos, **no on-chain**. Que el inventario esté firmado **no es requisito** para hacer el check-out.

### F10 · Check-out y cierre — 🟡

**Pantalla:** `/contratos/[id]`

1. El **dueño** abre el check-out (`POST …/checkout/iniciar`): `ACTIVO → EN_CHECKOUT`.
2. Compara con el inventario inicial y elige:
   - **Reclamar daños** (`POST …/checkout/reclamar`): monto y motivo; el monto no puede superar la garantía y se **descuenta de ella**.
   - **Check-out conforme** (`POST …/checkout/aprobar`): `EN_CHECKOUT → FINALIZADO`. Se registra que se devuelven **garantía restante + aportes** al inquilino, el inmueble vuelve a `PUBLICADO` y **el folio queda libre** (se puede crear otro contrato).
3. Si no hay acuerdo: disputa (F8).

**Simulado:** la devolución del dinero (es un registro, no una transferencia).
**Límite importante:** si el dueño no juntó todo el monto, la diferencia **no se trata como deuda** después de finalizar. Antes de finalizar se ve como "Falta juntar X". El préstamo puente es hoja de ruta.

### F11 · Calificación y reputación — 🟡

**Pantalla:** `/contratos/[id]` (cuando está finalizado) y `Mi panel`

- Cada parte califica a la otra de 1 a 5 estrellas con un comentario opcional, **una sola vez** (`POST …/calificaciones`).
- Los niveles **suben solos** según contratos finalizados y promedio recibido, y **nunca bajan**:

| Nivel | Condición |
|---|---|
| 🥉 Bronce | 1 contrato cumplido y promedio ≥ 3,5 |
| 🥈 Plata | 2 contratos y promedio ≥ 4 |
| 🥇 Oro | 3 contratos y promedio ≥ 4,5 |

- `Mi panel` muestra promedio, número de reseñas, contratos cumplidos y los comentarios recientes (`GET /api/usuarios/:id/reputacion`).

**Simulado:** el historial de ahorro en Vaquita (viene del seed).
**Falta:** aval de otro usuario, comprobantes de ingresos y el **pasaporte portable on-chain**.

### F12 · Derechos Reales (opcional) — ✅

**Pantalla:** `/contratos/[id]`

Guía de 5 pasos (notario, presentar la minuta, pagar tasas, pedir el folio actualizado, subirlo). Al subir el archivo (`POST …/ddrr`) el inmueble gana la insignia **"Inscrito en DD.RR."**.
**Límite:** no se verifica que el archivo sea un folio. Utama no hace el trámite ni hay notarios aliados.

### F13 · Notificaciones — ✅

**Pantalla:** campana en la barra superior (`GET /api/notificaciones?usuarioId=…`, se actualiza cada 20 s)

No se guardan: **se calculan al consultar** a partir de la base de datos. Tipos: ofertas recibidas y respondidas, visitas de los próximos 7 días, contratos que vencen en 90 días o menos, check-out pendiente de revisión, disputas abiertas, renovaciones sin responder y avance del plan de devolución del dueño.
**Falta:** marcar como leídas, y envío por correo o push.

### F14 · Hoja de ruta — ✅ (informativa)

**Pantalla:** `/hoja-de-ruta`. Las 5 etapas del documento y los módulos futuros (Crédito, Invierte, agentes, rendimiento con Blend, administración), marcados "Próximamente". No tiene funciones detrás.

### F15 · Herramientas de la demo — ✅

- **Selector de usuario** (barra superior): cambia el rol con el que se usa la app.
- **↺ Reiniciar la demo** (`POST /api/demo/reset`): borra contratos, visitas y ofertas; deja todos los inmuebles disponibles; quita las insignias de Derechos Reales; devuelve los niveles de los 4 usuarios de ejemplo; repone los horarios. **No** borra los usuarios ni los inmuebles que hayas creado.
- **Tema claro / oscuro** (ícono de sol o luna): se guarda en el navegador y, si no hay elección, sigue la preferencia del sistema. También acepta `?tema=oscuro` o `?tema=claro` en la dirección.
- **Iconos y selectores propios:** no se usan emojis; los iconos son un set geométrico (chakana, estrella de 8 puntas y rombo como símbolos, más trazos angulosos para acciones) y los desplegables son un componente propio con teclado (flechas, Enter, Esc y primera letra).
- **Móvil:** menú desplegable, tarjetas apiladas y, en la ficha del inmueble, una barra fija inferior con el precio y el botón "Tomar en anticrético".

---

## 4. Catálogo de la API

Todas bajo `/api`. Sin autenticación.

| Método y ruta | Para qué |
|---|---|
| `GET /health` | Comprobar que el servidor está arriba |
| `GET /reglas` | Categorías de reglas, penalidades y garantía recomendada |
| `GET /config` | Tipo de cambio y comisión (referenciales) |
| `POST /demo/reset` | Reiniciar la demo |
| `GET /usuarios`, `GET /usuarios/:id` | Listar y leer usuarios |
| `POST /usuarios` | Registrarse |
| `POST /usuarios/:id/verificar-identidad` | Verificación (simulada) |
| `PATCH /usuarios/:id/wallet` | Asociar la wallet Stellar |
| `GET /usuarios/:id/reputacion` | Promedio, contratos cumplidos, nivel |
| `GET /inmuebles` | Listado con filtros |
| `GET /inmuebles/:id?usuarioId=` | Ficha (dirección según quién consulta) |
| `POST /inmuebles` | Publicar (exige folio verificado) |
| `GET /folio/escenarios` | Folios de ejemplo |
| `POST /folio/verificar` | Verificación **simulada**; devuelve el hash |
| `GET /folio/:hash/estado` | ¿Folio bloqueado? |
| `GET/POST /inmuebles/:id/disponibilidad` | Horarios de visita |
| `DELETE /disponibilidad/:id` | Borrar un horario libre |
| `POST /visitas`, `GET /visitas?usuarioId=`, `DELETE /visitas/:id` | Visitas |
| `POST /ofertas`, `GET /ofertas`, `PATCH /ofertas/:id` | Ofertas |
| `POST /contratos`, `GET /contratos`, `GET /contratos/:id` | Contratos |
| `POST /contratos/:id/aportes` | Aporte al plan de devolución |
| `POST /contratos/:id/checkout/{iniciar,reclamar,aprobar}` | Check-out |
| `POST /contratos/:id/disputa`, `…/disputa/resolver` | Disputa |
| `POST /contratos/:id/salida-anticipada` | Salida anticipada |
| `POST /contratos/:id/renovacion/{proponer,aceptar}` | Renovación |
| `POST /contratos/:id/ddrr` | Comprobante de Derechos Reales |
| `POST /contratos/:id/calificaciones` | Calificación mutua |
| `GET /contratos/:id/inventario`, `PUT …/:fase`, `POST …/:fase/firmar` | Inventario |
| `GET /notificaciones?usuarioId=` | Notificaciones |
| `POST /uploads` | Subir imagen o PDF (hasta 8 MB) |

**Tablas:** `Usuario`, `Inmueble`, `Foto`, `Disponibilidad`, `Visita`, `Oferta`, `Contrato`, `Inventario`, `Evento`, `Calificacion`.
**Estados del contrato:** `ACTIVO → EN_CHECKOUT → FINALIZADO`, con `EN_DISPUTA` como desvío. El folio está bloqueado en `ACTIVO`, `EN_CHECKOUT` y `EN_DISPUTA`.

---

## 5. Lo que NO funciona o no existe

| Qué | Por qué importa |
|---|---|
| Contrato Soroban y modo `testnet` | Es el núcleo del pitch. Hoy todo el "contrato" lo simula el backend |
| Integración con Pollar y wallet real | Sin ella no hay firmas reales |
| Integración con Vaquita | Solo hay un dato de ejemplo |
| Lectura real del Folio Real con IA | Hoy es un resultado predefinido |
| Chat entre inquilino y dueño | Solo hay ofertas |
| Firma digital propia del contrato | La firma es el botón "Firmar y pagar" |
| Correo, SMS y notificaciones push | Solo la campana dentro de la app |
| Mapa sin internet | El mapa base viene de OpenStreetMap: sin conexión no se dibujan las calles (los alfileres sí). No es para uso masivo; para producción hay que usar un proveedor de mapas propio |
| Agentes inmobiliarios y verificadores, Utama Crédito, Utama Invierte, administración | Hoja de ruta |
| Comisión de Utama | Se muestra 0,5 % como referencia, **es un número inventado** y no se cobra |
| Tipos de contrato "alquiler con garantía" y "mixto" | Se pueden elegir al publicar, pero el flujo de pago es el del anticrético |
| Estados `BORRADOR` de inmueble, `RENOVADO` de contrato y `REALIZADA` de visita | Existen en la base de datos y nada los usa |

## 6. Riesgos y limitaciones conocidas

Conviene saberlos antes de mostrar o desplegar el proyecto:

1. **Sin autenticación ni permisos en el backend.** Cualquiera puede ejecutar cualquier acción como cualquier usuario llamando a la API.
2. **`POST /api/demo/reset` está abierto.** En un despliegue público cualquiera podría borrar los contratos de la demo.
3. **Los documentos subidos (CI, selfie, folio) se guardan sin cifrar** en `api/uploads` y se sirven por una dirección pública que solo se protege por tener un nombre difícil de adivinar. No hay datos reales en la demo; **no subas documentos reales**.
4. **El contenedor de la API ejecuta `prisma db push --accept-data-loss` al arrancar.** Sirve para la demo, pero un cambio del esquema podría borrar datos. Para algo duradero hay que usar migraciones.
5. **No hay pruebas automáticas.** Lo que se ha verificado es: compilación, llamadas reales a la API y capturas de pantalla.
6. La verificación visual se hizo con capturas de Edge en escritorio, tableta y móvil, en tema claro y oscuro. **No** se probó en un celular real ni en Safari.

## 7. Qué hay que hacer para que sea "de verdad"

En orden de importancia para la hackatón:

1. Escribir y desplegar el contrato Soroban ([PASOS-BLOCKCHAIN.md](PASOS-BLOCKCHAIN.md)).
2. Completar `web/src/lib/anticretico/stellar.ts` para que el flujo F7 y F8 llamen al contrato.
3. Conectar Pollar para el inicio de sesión y la wallet (reemplaza el selector de usuario).
4. Confirmar con los mentores cómo leer el historial de ahorro de Vaquita.
5. Si hay llave de IA, reemplazar el cuerpo de `FolioService.verificar` por la lectura real (las pantallas no cambian).
