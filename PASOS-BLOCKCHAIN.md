# Utama — Guía de la parte blockchain (para hacer tú)

Esta guía cubre todo lo que **no** estoy construyendo yo: instalar herramientas, escribir y desplegar el contrato Soroban, conectar la wallet y enlazarlo con el backend y el frontend.

Yo construyo en paralelo el backend (`api/`), el frontend (`web/`) y el Docker. Tú trabajas en `contracts/` y en un archivo del frontend (`web/src/lib/anticretico/stellar.ts`).

> **Aviso:** el código Rust de esta guía está escrito sin poder compilarlo aquí. Los nombres de funciones del SDK de Soroban cambian entre versiones. Si algo no compila, la fuente de verdad es el mensaje del compilador y la plantilla que genera `stellar contract init`.

Referencias: https://developers.stellar.org/docs/build/smart-contracts/getting-started

---

## Paso 0 — Orden recomendado y tiempos

| # | Paso | Tiempo aprox. |
|---|---|---|
| 1 | Instalar herramientas (Build Tools, Rust, Stellar CLI) | 30 min (casi todo esperando) |
| 2 | Crear cuentas de prueba y el token USDC de prueba | 20 min |
| 3 | Escribir el contrato | 2 a 3 h |
| 4 | Tests del contrato | 1 h |
| 5 | Desplegar en testnet | 30 min |
| 6 | Generar bindings de TypeScript | 15 min |
| 7 | Implementar `stellar.ts` en el frontend | 2 h |
| 8 | Pollar (login y wallet) | 1 a 2 h |
| 9 | Vaquita (reputación) | Depende de los mentores |

**Mientras se instala (paso 1), ve haciendo el paso 9:** escribe a los mentores de la hackatón pidiendo el contacto de Vaquita y las docs de Pollar.

---

## Paso 1 — Instalar herramientas (Windows)

Abre **PowerShell como administrador** para el primer comando.

1. **Visual Studio Build Tools** con la carga de C++ (pesa varios GB):
   ```powershell
   winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
   ```
2. **Rust**:
   ```powershell
   winget install Rustlang.Rustup
   ```
   Cierra y abre la terminal. Luego:
   ```powershell
   rustup default stable
   rustup target add wasm32v1-none
   ```
   Si `wasm32v1-none` no existe en tu versión de Rust, usa `rustup target add wasm32-unknown-unknown` y ajusta la ruta del `.wasm` en los pasos 5 y 6.
3. **Stellar CLI**:
   ```powershell
   winget install Stellar.StellarCLI
   ```
   Si el paquete no existe: `cargo install --locked stellar-cli` (tarda 10 a 20 minutos).
4. **Verificar** (en una terminal nueva):
   ```powershell
   rustc --version
   cargo --version
   stellar --version
   ```
   Si alguno dice "no se reconoce", cierra y abre la terminal otra vez. Si persiste, el programa no quedó en el PATH.

---

## Paso 2 — Cuentas de prueba y token USDC de prueba

Usamos un token de prueba propio en vez del USDC oficial, porque así controlas el emisor y puedes repartir fondos sin depender de nadie.

1. **Red testnet** (suele venir configurada; si no):
   ```powershell
   stellar network add testnet --rpc-url https://soroban-testnet.stellar.org --network-passphrase "Test SDF Network ; September 2015"
   ```
2. **Crear tres cuentas** (cada una se fondea sola con XLM de prueba):
   ```powershell
   stellar keys generate usdc-issuer --network testnet --fund
   stellar keys generate utama-dueno --network testnet --fund
   stellar keys generate utama-inquilino --network testnet --fund
   ```
   Para ver una dirección: `stellar keys address utama-dueno`.
3. **Desplegar el token** (un Stellar Asset Contract para `USDC` emitido por `usdc-issuer`):
   ```powershell
   $ISSUER = stellar keys address usdc-issuer
   stellar contract asset deploy --asset "USDC:$ISSUER" --source usdc-issuer --network testnet
   ```
   El comando imprime un **ID de contrato** que empieza con `C...`. **Guárdalo:** es `TOKEN_ID`.
4. **Dar a dueño e inquilino la capacidad de tener USDC** (trustline) y **fondos de prueba**:
   ```powershell
   stellar tx new change-trust --line "USDC:$ISSUER" --source-account utama-dueno --network testnet
   stellar tx new change-trust --line "USDC:$ISSUER" --source-account utama-inquilino --network testnet
   stellar tx new payment --destination (stellar keys address utama-inquilino) --asset "USDC:$ISSUER" --amount 100000000000 --source-account usdc-issuer --network testnet
   ```
   Los nombres exactos de las opciones pueden variar. Si fallan, revisa `stellar tx new change-trust --help` y `stellar tx new payment --help`. Ten en cuenta que las cantidades van en la unidad mínima (7 decimales en activos de Stellar, así que `100000000000` son 10.000 USDC).

---

## Paso 3 — Crear y escribir el contrato

### 3.1 Estructura
Desde `c:\sistemas\utama`:
```powershell
stellar contract init contracts --name utama
```
Esto crea `contracts/contracts/utama/` con `Cargo.toml` y `src/lib.rs`. **No cambies las versiones del `Cargo.toml`** que genera.

### 3.2 Qué debe hacer (resumen)
Es el escrow del anticrético, basado en el módulo M8 de la definición del sistema.

| Función | Qué hace |
|---|---|
| `initialize(token)` | Guarda la dirección del token USDC. Se llama una sola vez |
| `crear_anticretico(dueno, inquilino, folio_hash, monto, garantia_pct, plazo_segundos)` | Falla si el folio ya está ocupado. Cobra `monto` al inquilino. Reparte `monto - garantia` al dueño y `garantia` queda en el contrato. Bloquea el folio |
| `aportar_devolucion(id, monto)` | El dueño aporta a su plan de devolución. Suma al acumulado |
| `estado_devolucion(id)` | Devuelve `(acumulado, monto_total)` |
| `iniciar_checkout(id)` | Pasa el estado de `Activo` a `EnCheckout` |
| `reclamar_danos(id, monto)` | El dueño toma parte de la garantía (solo en `EnCheckout`) |
| `aprobar_checkout(id)` | Devuelve garantía restante + acumulado al inquilino, libera el folio, estado `Finalizado` |
| `folio_ocupado(folio_hash)` | `true` si hay un contrato vigente con ese folio |
| `obtener(id)` | Devuelve los datos del contrato |

**Regla clave:** el mismo `folio_hash` no puede tener dos contratos activos. Ese rechazo es el momento central de la demo.

### 3.3 Borrador de `lib.rs`
Reemplaza el contenido de `contracts/contracts/utama/src/lib.rs`:

```rust
#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, BytesN, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    YaInicializado = 1,
    FolioOcupado = 2,
    NoExiste = 3,
    EstadoInvalido = 4,
    ParametrosInvalidos = 5,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Estado {
    Activo,
    EnCheckout,
    Finalizado,
}

#[contracttype]
#[derive(Clone)]
pub struct Anticretico {
    pub id: u32,
    pub dueno: Address,
    pub inquilino: Address,
    pub folio_hash: BytesN<32>,
    pub monto: i128,
    pub garantia: i128,
    pub acumulado: i128,
    pub inicio: u64,
    pub vencimiento: u64,
    pub estado: Estado,
}

#[contracttype]
pub enum Clave {
    Token,
    Contador,
    Folio(BytesN<32>),
    Contrato(u32),
}

#[contract]
pub struct Utama;

#[contractimpl]
impl Utama {
    pub fn initialize(env: Env, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&Clave::Token) {
            return Err(Error::YaInicializado);
        }
        env.storage().instance().set(&Clave::Token, &token);
        env.storage().instance().set(&Clave::Contador, &0u32);
        Ok(())
    }

    pub fn crear_anticretico(
        env: Env,
        dueno: Address,
        inquilino: Address,
        folio_hash: BytesN<32>,
        monto: i128,
        garantia_pct: u32,
        plazo_segundos: u64,
    ) -> Result<u32, Error> {
        inquilino.require_auth();

        if monto <= 0 || garantia_pct > 100 {
            return Err(Error::ParametrosInvalidos);
        }
        if env.storage().persistent().has(&Clave::Folio(folio_hash.clone())) {
            return Err(Error::FolioOcupado);
        }

        let garantia = monto * (garantia_pct as i128) / 100;
        let al_dueno = monto - garantia;

        let token_addr: Address = env.storage().instance().get(&Clave::Token).unwrap();
        let token = token::Client::new(&env, &token_addr);
        token.transfer(&inquilino, &dueno, &al_dueno);
        token.transfer(&inquilino, &env.current_contract_address(), &garantia);

        let id: u32 = env.storage().instance().get(&Clave::Contador).unwrap_or(0) + 1;
        env.storage().instance().set(&Clave::Contador, &id);

        let ahora = env.ledger().timestamp();
        let contrato = Anticretico {
            id,
            dueno,
            inquilino,
            folio_hash: folio_hash.clone(),
            monto,
            garantia,
            acumulado: 0,
            inicio: ahora,
            vencimiento: ahora + plazo_segundos,
            estado: Estado::Activo,
        };

        env.storage().persistent().set(&Clave::Contrato(id), &contrato);
        env.storage().persistent().set(&Clave::Folio(folio_hash), &id);
        Ok(id)
    }

    pub fn aportar_devolucion(env: Env, id: u32, monto: i128) -> Result<(), Error> {
        let mut c = Self::cargar(&env, id)?;
        c.dueno.require_auth();
        if c.estado != Estado::Activo || monto <= 0 {
            return Err(Error::EstadoInvalido);
        }
        let token = Self::token(&env);
        token.transfer(&c.dueno, &env.current_contract_address(), &monto);
        c.acumulado += monto;
        env.storage().persistent().set(&Clave::Contrato(id), &c);
        Ok(())
    }

    pub fn estado_devolucion(env: Env, id: u32) -> Result<(i128, i128), Error> {
        let c = Self::cargar(&env, id)?;
        Ok((c.acumulado, c.monto))
    }

    pub fn iniciar_checkout(env: Env, id: u32) -> Result<(), Error> {
        let mut c = Self::cargar(&env, id)?;
        c.dueno.require_auth();
        if c.estado != Estado::Activo {
            return Err(Error::EstadoInvalido);
        }
        c.estado = Estado::EnCheckout;
        env.storage().persistent().set(&Clave::Contrato(id), &c);
        Ok(())
    }

    pub fn reclamar_danos(env: Env, id: u32, monto: i128) -> Result<(), Error> {
        let mut c = Self::cargar(&env, id)?;
        c.dueno.require_auth();
        if c.estado != Estado::EnCheckout || monto <= 0 || monto > c.garantia {
            return Err(Error::EstadoInvalido);
        }
        let token = Self::token(&env);
        token.transfer(&env.current_contract_address(), &c.dueno, &monto);
        c.garantia -= monto;
        env.storage().persistent().set(&Clave::Contrato(id), &c);
        Ok(())
    }

    pub fn aprobar_checkout(env: Env, id: u32) -> Result<(), Error> {
        let mut c = Self::cargar(&env, id)?;
        c.dueno.require_auth();
        if c.estado != Estado::EnCheckout {
            return Err(Error::EstadoInvalido);
        }
        let a_devolver = c.garantia + c.acumulado;
        if a_devolver > 0 {
            let token = Self::token(&env);
            token.transfer(&env.current_contract_address(), &c.inquilino, &a_devolver);
        }
        c.estado = Estado::Finalizado;
        env.storage().persistent().set(&Clave::Contrato(id), &c);
        env.storage().persistent().remove(&Clave::Folio(c.folio_hash.clone()));
        Ok(())
    }

    pub fn folio_ocupado(env: Env, folio_hash: BytesN<32>) -> bool {
        env.storage().persistent().has(&Clave::Folio(folio_hash))
    }

    pub fn obtener(env: Env, id: u32) -> Result<Anticretico, Error> {
        Self::cargar(&env, id)
    }

    fn cargar(env: &Env, id: u32) -> Result<Anticretico, Error> {
        env.storage()
            .persistent()
            .get(&Clave::Contrato(id))
            .ok_or(Error::NoExiste)
    }

    fn token(env: &Env) -> token::Client<'_> {
        let addr: Address = env.storage().instance().get(&Clave::Token).unwrap();
        token::Client::new(env, &addr)
    }
}

mod test;
```

**Decisiones de diseño que debes revisar tú:**
- **El saldo de la devolución.** `aprobar_checkout` devuelve solo `garantía restante + acumulado`. Si el dueño no juntó todo el monto, la diferencia queda como deuda fuera del contrato. Hay que decidir cómo explicarlo en el pitch (es justo el problema que resuelve el "plan de devolución").
- **Quién inicia el check-out.** Aquí solo el dueño. Podrías permitir también al inquilino.
- **Expiración del almacenamiento.** En Soroban los datos persistentes caducan si nadie extiende su vida. Para la demo no importa; para producción habría que llamar a `extend_ttl`.

---

## Paso 4 — Tests del contrato

Crea `contracts/contracts/utama/src/test.rs`. Debe probar, como mínimo:

1. Crear un anticrético reparte bien los fondos (dueño recibe el 85 %, el contrato retiene el 15 %).
2. **Un segundo anticrético con el mismo `folio_hash` falla con `Error::FolioOcupado`.**
3. Tras `iniciar_checkout` + `aprobar_checkout`, el inquilino recibe su dinero y el folio queda libre (se puede crear otro contrato).

Esqueleto (ajusta a la versión del SDK):
```rust
#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, BytesN, Env};

fn preparar<'a>(env: &Env) -> (UtamaClient<'a>, Address, Address, Address) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(admin);
    let token_addr = sac.address();
    let inquilino = Address::generate(env);
    let dueno = Address::generate(env);
    token::StellarAssetClient::new(env, &token_addr).mint(&inquilino, &1_000_000);

    let id = env.register(Utama, ());
    let client = UtamaClient::new(env, &id);
    client.initialize(&token_addr);
    (client, token_addr, dueno, inquilino)
}

#[test]
fn doble_anticretico_rechazado() {
    let env = Env::default();
    let (client, _t, dueno, inquilino) = preparar(&env);
    let folio = BytesN::from_array(&env, &[7u8; 32]);

    client.crear_anticretico(&dueno, &inquilino, &folio, &100_000, &15, &31_536_000);
    let segundo = client.try_crear_anticretico(&dueno, &inquilino, &folio, &100_000, &15, &31_536_000);
    assert_eq!(segundo, Err(Ok(Error::FolioOcupado)));
}
```
Para correr los tests:
```powershell
cd contracts
cargo test
```
Si `register_stellar_asset_contract_v2` o `env.register` no existen, tu versión del SDK es distinta. Mira cómo lo hace el test que genera `stellar contract init`.

---

## Paso 5 — Compilar y desplegar en testnet

Desde `contracts/`:
```powershell
stellar contract build
```
El archivo compilado queda en `target/wasm32v1-none/release/utama.wasm` (o `target/wasm32-unknown-unknown/release/` según el objetivo que hayas instalado).

Desplegar:
```powershell
stellar contract deploy --wasm target/wasm32v1-none/release/utama.wasm --source utama-dueno --network testnet --alias utama
```
Imprime el **ID del contrato** (`C...`). **Guárdalo:** es `CONTRACT_ID`.

Inicializar con el token del paso 2:
```powershell
stellar contract invoke --id utama --source utama-dueno --network testnet -- initialize --token <TOKEN_ID>
```

**Prueba a mano** (esto equivale a la demo):
```powershell
# folio de ejemplo (32 bytes en hex = 64 caracteres)
$FOLIO = "07" * 32
stellar contract invoke --id utama --source utama-inquilino --network testnet -- crear_anticretico --dueno (stellar keys address utama-dueno) --inquilino (stellar keys address utama-inquilino) --folio_hash $FOLIO --monto 1000000000 --garantia_pct 15 --plazo_segundos 31536000
```
Repite el mismo comando: la segunda vez debe fallar con el error `FolioOcupado` (`Error(Contract, #2)`). **Si ves eso, tienes la demo funcionando.**

Anota en un archivo `contracts/DEPLOY.md`: `CONTRACT_ID`, `TOKEN_ID`, la dirección del emisor y la fecha. Lo vas a necesitar en el frontend.

---

## Paso 6 — Generar los bindings de TypeScript

Esto crea un cliente tipado para llamar al contrato desde el frontend:
```powershell
stellar contract bindings typescript --contract-id <CONTRACT_ID> --output-dir ../web/src/contract-client --network testnet
cd ../web/src/contract-client
npm install
npm run build
```
Luego, en `web/`:
```powershell
npm install ./src/contract-client
```
(o importa directamente desde la carpeta, según cómo quede el `package.json` que se genere).

---

## Paso 7 — Conectar el frontend: `stellar.ts`

El frontend usa una interfaz común con dos implementaciones. Yo dejo creados:

- `web/src/lib/anticretico/types.ts` — la interfaz `AnticreticoService`.
- `web/src/lib/anticretico/mock.ts` — usa el backend para simular el contrato.
- `web/src/lib/anticretico/stellar.ts` — **un esqueleto que lanza "no implementado". Lo completas tú.**
- `web/src/lib/anticretico/index.ts` — elige según `NEXT_PUBLIC_MODE` (`mock` o `testnet`).

> **Ya está hecho (no lo toques):** `types.ts` define `AnticreticoService` y los parámetros que recibe cada método. En `crearAnticretico` te llega `p.inmueble` (con `folioHash` y `dueno.wallet`) y `p.inquilino` (con `wallet`). En los demás métodos te llega el `Contrato` completo, con `onchainId`, `dueno.wallet` e `inquilino.wallet`. **Las wallets están vacías hasta que alguien las asocia:** en `Mi panel` hay un campo "Asociar wallet Stellar", y el endpoint es `PATCH /api/usuarios/:id/wallet`. Cuando integres Pollar, ahí es donde se guarda la dirección que te entregue.

Qué debe hacer cada método de `stellar.ts`:

1. **Llamar al contrato** con los bindings (firmando con la wallet del usuario, ver paso 8).
2. **Registrar el resultado en el backend** con `fetch` a la API (para que las pantallas lo muestren), mandando `onchainId` y `txHash`.

Endpoints del backend que ya tendrás disponibles (yo los construyo):

| Método y ruta | Para qué |
|---|---|
| `POST /api/contratos` | Crear el espejo del contrato. Body: `{ inmuebleId, inquilinoId, montoUsdc, plazoMeses, garantiaPct, modo: "testnet", onchainId, txHash }` |
| `POST /api/contratos/:id/aportes` | Registrar un aporte. Body: `{ montoUsdc, txHash }` |
| `POST /api/contratos/:id/checkout/iniciar` | Body: `{ txHash }` |
| `POST /api/contratos/:id/checkout/reclamar` | Body: `{ montoUsdc, motivo, txHash }` |
| `POST /api/contratos/:id/checkout/aprobar` | Body: `{ txHash }` |
| `GET /api/folio/:hash/estado` | Dice si un folio está ocupado en la base de datos |
| `POST /api/folio/verificar` | Verificación simulada; devuelve el `folioHash` (SHA-256 en hexadecimal) que se manda al contrato |

**Importante:** el `folioHash` que va al contrato es el que devuelve `POST /api/folio/verificar`. Conviértelo de hexadecimal a bytes (`Buffer.from(hex, "hex")`) para el parámetro `BytesN<32>`.

---

## Paso 8 — Login y wallet con Pollar

1. Entra a la documentación de Pollar (pollar.xyz) y crea una cuenta de desarrollador. Si no encuentras las docs, pídelas a los mentores.
2. En `web/`:
   ```powershell
   npm install @pollar/core @pollar/react
   ```
3. Obtén la **API key** o el **client ID** de Pollar y ponlo en `web/.env.local` (nunca en el repositorio).
4. Sigue su guía para: (a) iniciar sesión, (b) obtener la dirección Stellar del usuario, (c) firmar transacciones.
5. Úsalo en `stellar.ts` como el firmante de las llamadas al contrato.
6. **Plan B** si Pollar se complica: Stellar Wallets Kit con Freighter (extensión del navegador en modo testnet). Mientras tanto, el frontend funciona con un selector de usuarios de demostración.

La dirección Stellar del usuario debe guardarse en su registro del backend (campo `wallet` de `Usuario`).

---

## Paso 9 — Vaquita (reputación)

1. Pide a los mentores el contacto del equipo de Vaquita y pregunta: ¿cómo puede leer una app de terceros el historial de ahorro de un usuario? (contrato en testnet, API, otra cosa).
2. Con la respuesta, lo leemos desde el backend y mostramos "Historial de ahorro" en el perfil.
3. **Si no responden antes del sábado:** el backend ya traerá datos de ejemplo para esa sección, y en el pitch se presenta como la integración prevista.

---

## Checklist de lo tuyo

- [ ] Rust, Stellar CLI y Build Tools instalados y verificados
- [ ] Cuentas `usdc-issuer`, `utama-dueno`, `utama-inquilino` creadas
- [ ] Token de prueba desplegado (`TOKEN_ID` anotado) y fondos repartidos
- [ ] Contrato escrito y `cargo test` en verde (incluido el test del doble anticrético)
- [ ] Contrato desplegado en testnet (`CONTRACT_ID` anotado)
- [ ] El doble anticrético falla a mano con `FolioOcupado`
- [ ] Bindings de TypeScript generados en `web/src/contract-client`
- [ ] `stellar.ts` implementado y `NEXT_PUBLIC_MODE=testnet` funcionando
- [ ] Pollar conectado (o Freighter como plan B)
- [ ] Contacto de Vaquita pedido a los mentores
