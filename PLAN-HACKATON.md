# Utama — Plan para la hackatón

Complemento de [utama-definicion-del-sistema.md](utama-definicion-del-sistema.md). Aquí está lo operativo: fechas, requisitos, instalación, modo mock y plan día a día.

> Estado al 19 de noviembre de 2026. Quedan 3 días para cerrar la etapa virtual.

---

## 1. Datos del evento (Stellar Bolivia 2026 — National Startups Hackathon)

| Dato | Valor |
|---|---|
| Etapa virtual | 9 al 22 de noviembre |
| Cierre de envíos | **22 de noviembre** |
| Anuncio de finalistas | 23 de noviembre |
| Final presencial | 27 de noviembre, Santa Cruz (pitch ante jurado) |
| Premios | USDC 10.000: 1.º USDC 5.000, 2.º USDC 5.000 + incubación |
| Finalistas | Pasaje pagado para un representante por equipo |
| Equipo | 2 a 5 personas, al menos una técnica |
| Costo | Gratis |
| Inscripción | https://tally.so/r/2jj26A |

**Los 4 pilares (lo que evalúan, según la página):**
1. **Usa Stellar** — pagos, stablecoins, tokenización o identidad. Blockchain como pieza central.
2. **Integra el ecosistema** — Vaquita, Pollar u otras. "Cuanto mejor integres lo que hay, más posibilidades de ganar."
3. **Resuelve algo real** — problema de Bolivia que cuesta tiempo o dinero.
4. **Llega a fondeo** — los mejores pasan a incubación y al Stellar Community Fund (15k a 150k USD).

**Pendiente de confirmar (la página no lo dice):**
- [ ] Dónde y cómo se envía el proyecto (formulario, DoraHacks, otro).
- [ ] Qué se entrega exactamente (repo, video, deck, demo en vivo).
- [ ] Criterios de evaluación y sus pesos.
- [ ] Canal de mentoría (Discord / WhatsApp) y contacto de Vaquita y Pollar.
- [ ] Si el equipo está inscrito y tiene al menos una persona técnica.

---

## 2. ¿Rust y Stellar CLI son indispensables?

| Parte | ¿Se puede avanzar sin Rust/Stellar CLI? |
|---|---|
| Frontend (listado, ficha, paneles, check-in/out, cámara) | **Sí**, con modo mock |
| Lectura del Folio Real con IA | **Sí**, no depende de Stellar |
| Login/wallet con Pollar | **Sí**, es un paquete de npm |
| **Contrato Soroban** | **No.** Hay que compilarlo y desplegarlo con Rust y Stellar CLI |

**Conclusión:** el modo mock sirve para no frenar el trabajo mientras se instala, pero **no reemplaza al contrato real**. El pilar 1 exige que la blockchain sea la pieza central, así que la demo final y la entrega deben correr contra el contrato en testnet. Un jurado que descubra que todo era simulado descartaría el proyecto.

Regla: **el mock es solo para desarrollo.** La entrega se hace con `NEXT_PUBLIC_MODE=testnet`.

---

## 3. Stack tecnológico (decidido)

| Capa | Tecnología | Nota |
|---|---|---|
| Frontend | **Next.js** (App Router) + TypeScript | Solo pantallas; consume la API del backend |
| Backend | **NestJS** + **Prisma** | Carpeta `api/`. Datos, calendario, subida de fotos, hash del folio, verificación simulada |
| Estilos | Tailwind CSS + shadcn/ui | Para armar pantallas rápido |
| Contrato | **Soroban** (Rust) + Stellar CLI | Tests con `cargo test` |
| Cliente de la cadena | `@stellar/stellar-sdk` + bindings TypeScript generados | Se generan con `stellar contract bindings typescript` |
| Login y wallet | **Pollar** (`@pollar/core`, `@pollar/react`) | Respaldo: Stellar Wallets Kit / Freighter |
| Moneda del escrow | USDC de testnet | |
| Base de datos | **PostgreSQL 16** en Docker (puerto 5440 en tu equipo), con datos de ejemplo (seed) | Prisma 7. El puerto 5432 lo usan otros proyectos tuyos |
| Fotos y archivos subidos | Carpeta `uploads/` del backend | Volumen de Docker `utama-uploads` |
| Estado del contrato en modo mock | Tabla `Contrato` con `modo = "mock"` | Compartida entre dueño e inquilino. En testnet la misma tabla guarda `onchainId` y `txHash`. Ver sección 5 |
| Entorno | **Docker Compose** (`db`, `api`, `web`) | Ver [README.md](README.md) |
| Despliegue | Local primero; Vercel si el jurado necesita un enlace público | Decidir antes del sábado |

### Verificación del Folio Real: simulada por ahora
El endpoint `POST /folio/verificar` del backend **no usa IA todavía**. Devuelve un resultado predefinido según el folio de ejemplo elegido:

| Folio de ejemplo | Resultado |
|---|---|
| Folio limpio | Titular coincide con el CI, sin gravámenes → **Verificado** |
| Folio con hipoteca | **Rechazado:** tiene una hipoteca inscrita |
| Folio con otro titular | **Rechazado:** el titular no coincide con el CI |

- Se simula una espera de 2 segundos y se muestra una etiqueta **"Verificación simulada"** en la interfaz.
- **Lo que sí es real:** el hash SHA-256 del número de folio normalizado (sin puntos ni espacios) que se manda al contrato.
- Más adelante, la ruta se cambia por una llamada a un modelo de IA (por ejemplo, la API de Claude) sin tocar las pantallas. La llave iría en una variable de entorno del servidor.
- En el pitch se presenta como "extracción con IA" del roadmap, no como algo ya funcionando.

---

### Por qué hay backend y base de datos
Los datos deben compartirse entre usuarios (el dueño publica y define horarios; el inquilino, desde otro navegador, ve el inmueble y reserva) y tienen relaciones entre sí. Con archivos JSON o `localStorage` eso no funciona.

**Modelo de datos (ya creado en `api/prisma/schema.prisma`):** `Usuario`, `Inmueble` (con las reglas como campos), `Foto`, `Disponibilidad`, `Visita`, `Oferta`, `Contrato` (con `modo`, `onchainId` y `txHash`), `Inventario` (check-in y check-out) y `Evento` (historial del contrato).

### Prioridad de construcción (para no dejar el contrato a medias)
1. **Contrato Soroban** en testnet. Sin esto no hay proyecto.
2. **Inmuebles:** listado, ficha y publicar con fotos, desde la base de datos.
3. **Contrato conectado al flujo:** pago, folio bloqueado, rechazo del doble anticrético y check-out.
4. **Calendario simple:** el dueño marca horarios libres y el inquilino reserva uno. Sin recordatorios ni sincronización con Google.
5. **Ofertas e inventario** básicos.

Simulado o en slides: chat y negociación en vivo, notificaciones, conversión Bs↔USDC e IA real del Folio.

---

## 4. Instalación de herramientas (Windows)

Estado detectado: Node 24, npm 11 y git ya instalados. **Faltan** Visual Studio Build Tools, Rust y Stellar CLI.

1. **Visual Studio Build Tools** (carga "Desarrollo para escritorio con C++"; pesa varios GB):
   ```
   winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
   ```
2. **Rust** y el objetivo WebAssembly:
   ```
   winget install Rustlang.Rustup
   rustup target add wasm32v1-none
   ```
3. **Stellar CLI:**
   ```
   winget install Stellar.StellarCLI
   ```
   Alternativa si el paquete no existe: `cargo install --locked stellar-cli`.
4. Cerrar y abrir la terminal, y comprobar:
   ```
   rustc --version
   cargo --version
   stellar --version
   ```
5. Crear una cuenta de prueba y fondearla:
   ```
   stellar keys generate utama-dev --network testnet --fund
   ```

> Los nombres exactos del paquete de winget y del objetivo wasm están escritos de memoria. Si alguno falla, revisar https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup

---

## 5. Modo mock

### Idea
El frontend nunca habla directo con Stellar. Habla con una **interfaz** (`AnticreticoService`) que tiene dos implementaciones intercambiables.

```
src/
  services/
    anticretico.ts        <- interfaz (el "contrato" entre front y cadena)
    mock.ts               <- implementación simulada (localStorage)
    stellar.ts            <- implementación real (bindings del contrato Soroban)
    index.ts              <- elige según NEXT_PUBLIC_MODE
```

`.env`:
```
NEXT_PUBLIC_MODE=mock        # mock | testnet
```

### Interfaz (espeja las funciones del contrato, sección M8)
```ts
interface AnticreticoService {
  verificarFolio(folioHash: string): Promise<{ libre: boolean; contratoId?: string }>;
  crearAnticretico(p: { folioHash: string; duenoId: string; inquilinoId: string;
                        montoUsdc: number; plazoMeses: number; garantiaPct: number }): Promise<{ contratoId: string; txHash: string }>;
  estadoContrato(contratoId: string): Promise<Contrato>;
  aportarDevolucion(contratoId: string, montoUsdc: number): Promise<{ txHash: string }>;
  iniciarCheckout(contratoId: string): Promise<{ txHash: string }>;
  aprobarCheckout(contratoId: string): Promise<{ txHash: string }>;
}
```

### Qué debe hacer el mock
- Guardar contratos y folios bloqueados en la tabla `Contrato` del backend con `modo = "mock"` (así dueño e inquilino ven el mismo estado).
- Aplicar **las mismas reglas** que el contrato: reparto 80-90 % / 10-20 %, folio bloqueado mientras haya un contrato activo, liberación solo tras `aprobarCheckout`.
- Rechazar el doble anticrético con el mismo mensaje: *"Este inmueble ya tiene un anticrético activo."*
- Simular latencia (1 a 2 s) y devolver un `txHash` falso.
- Mostrar un **banner visible "MODO MOCK"** para que nunca se confunda con la versión real.

### Cuándo pasar a testnet
1. El contrato compila y pasa sus tests (`cargo test`).
2. Se despliega en testnet y se generan los bindings de TypeScript:
   ```
   stellar contract build
   stellar contract deploy --wasm target/wasm32v1-none/release/utama.wasm --source utama-dev --network testnet
   stellar contract bindings typescript --contract-id <ID> --output-dir src/contract-client --network testnet
   ```
3. Se escribe `stellar.ts` implementando la misma interfaz y se cambia `NEXT_PUBLIC_MODE=testnet`. El resto del frontend no se toca.

---

## 6. Plan día a día

| Día | Prioridad |
|---|---|
| **Jue 19** | Lanzar la instalación (sección 4) en segundo plano. Mientras tanto: backend Nest con la base de datos y los datos de ejemplo, y Next.js con el servicio mock (listado, ficha, botón "Tomar en anticrético") y la verificación simulada del Folio. Escribir el contrato Soroban en cuanto Rust esté listo. Pedir a los mentores el contacto de Vaquita y las docs de Pollar. |
| **Vie 20** | Contrato con tests, desplegado en testnet (`crear_anticretico`, bloqueo del folio, `aprobar_checkout`). Login y wallet con Pollar. |
| **Sáb 21** | Pasar el front a `NEXT_PUBLIC_MODE=testnet`, con pago en USDC de testnet. Si hay llave de API, cambiar la verificación simulada del Folio por IA real (opcional). Check-in y check-out básicos. Reputación con Vaquita (real si hay acceso, de ejemplo si no). Grabar el video. |
| **Dom 22** | Solo pulir y enviar. README, enlace al contrato en testnet, video y deck. Entregar temprano. |

---

## 7. Qué debe verse en la demo

1. Verificación del folio (simulada: titular y gravámenes; el hash a la cadena es real).
2. Pago en USDC con reparto 80-90 % al dueño y 10-20 % a garantía.
3. Folio bloqueado.
4. Segundo intento con el mismo folio, rechazado: *"Este inmueble ya tiene un anticrético activo."*
5. Check-out conforme: liberación del dinero y del folio.

**Va en slides (no se construye):** conversión Bs↔USDC, calendario, negociación, plan de devolución, Utama Crédito, Utama Invierte, agentes y expansión internacional. Incluir una slide con la ruta al Stellar Community Fund (pilar 4).

---

## 8. Checklist de entrega

- [ ] Equipo inscrito (2 a 5 personas, al menos una técnica)
- [ ] Contrato desplegado en testnet, con el enlace en el README
- [ ] Frontend corriendo con `NEXT_PUBLIC_MODE=testnet` (sin banner de mock)
- [ ] Al menos una integración real del ecosistema (Pollar o Vaquita)
- [ ] README con instrucciones para ejecutar el proyecto
- [ ] Video de la demo (2 a 3 minutos)
- [ ] Deck con el pitch y el roadmap
- [ ] Proyecto enviado en la plataforma indicada por la organización, antes del 22 de noviembre
