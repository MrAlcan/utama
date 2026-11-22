# Guía paso a paso: Configurar Pollar y obtener la key (`pub_testnet_...`)

Sigue estos pasos con calma para obtener la publishable key de **Pollar** en **Test mode (Stellar Testnet)** para Utama.

---

## 1. Crear la aplicación en Pollar

1. Abre **`https://dashboard.pollar.xyz`** en tu navegador e inicia sesión (o crea una cuenta).
2. Crea una aplicación nueva (por ejemplo, `Utama Testnet`).
3. Asegúrate de estar en **Test mode** (red Stellar Testnet, **no** Mainnet).

---

## 2. Copiar la Publishable Key (`pub_testnet_...`)

1. En el menú lateral ve a **Developers > API keys**.
2. Crea o copia la **Publishable key** que empieza con `pub_testnet_...`.
   - **Importante:** Pollar la muestra **una sola vez**; guárdala inmediatamente en un lugar seguro.
   - **Nunca** copies ni subas la key secreta (`sec_testnet_...`) al frontend (`web/`) ni al repositorio Git.

---

## 3. Configurar orígenes y redirecciones (OBLIGATORIO para Google OAuth)

1. Ve a **Developers > Websites**.
2. En **Allowed origins**, agrega cada URL por separado (**sin comodines `*`**):
   - `http://localhost:3000`
   - `https://<dominio-final-de-produccion>` *(pídele el dominio definitivo al Dev-3; las URLs de preview no funcionan si no están aquí)*.
3. En **Allowed redirect URIs**, agrega **exactamente las mismas URLs**:
   - `http://localhost:3000`
   - `https://<dominio-final-de-produccion>`
   - *Nota:* si **Allowed redirect URIs** queda vacía, el login con Google fallará con `APPLICATION_HAS_NO_REDIRECT_URIS`.

---

## 4. Activar USDC y comisiones patrocinadas

1. Ve a **Wallets > Tokens** y agrega **USDC (Circle)** en testnet:
   - Código: `USDC`
   - Emisor (issuer): `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
2. Ve a **Wallets > Sponsored fees** y activa el patrocinio para **USDC**.
   - *(Para la 2.ª entrega, cuando Pollar firme escrows de Trustless Work, aquí también se deberá activar **Sponsor all contracts**).*
3. *(Recomendado)* Ve a **Wallets > Starting balance** y activa **"Fund in test mode"** para fondear la wallet de pruebas.
4. *(Recomendado)* Ve a **Wallets > Settings > Signature confirmation** y deja **"always ask"** (así el modal de confirmación se ve claramente en la demo y el video).

---

## 5. Colocar la key en tu entorno local

Crea o edita `web/.env.local` (este archivo está ignorado por `.gitignore` y **no se sube a Git**):

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_MODE=mock
NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_testnet_TU_KEY_AQUI
DEMO_RESET_TOKEN=
```

> **Recordatorio para producción (Dev-3):** `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` se incrusta en tiempo de build en Next.js. Si se agrega o cambia en producción, hay que volver a construir/redesplegar `web/`.
