# Textos de envío

Para pegar en cualquier formulario. Ajustar los links cuando estén (`<demo>`, `<video>`, `<deck>`).

## 50 palabras
Utama protege a quien entrega sus ahorros en un anticrético en Bolivia. El dinero queda en un escrow en Stellar (USDC, Trustless Work) y llega al dueño solo cuando el anticrético está inscrito en Derechos Reales. Un contrato Soroban propio bloquea cada folio y rechaza el doble anticrético.

## 150 palabras
En Bolivia, quien toma un anticrético entrega entre 20.000 y 45.000 dólares a un desconocido y recién después intenta inscribir el contrato en Derechos Reales. En esa ventana ocurren el doble anticrético, el falso dueño y la no devolución.

Utama invierte el orden: primero se inscribe, después se paga. El inquilino deposita USDC en un escrow de Trustless Work sobre Stellar. Un verificador confirma la inscripción y recién entonces se libera el pago al dueño; si no hay inscripción, el escrow le devuelve el depósito al inquilino. La garantía queda en el escrow hasta el check-out.

Nuestro contrato Soroban, `utama-folios`, registra cada folio verificado y rechaza en la cadena un segundo anticrético sobre el mismo inmueble. Pollar permite entrar con Google y tener una wallet sin saber de cripto. Cobramos 1 %, solo si el trato se concreta. Todo funciona hoy en testnet, con transacciones verificables en stellar.expert.

## 280 palabras
**Problema.** El anticrético es una forma muy boliviana de vivienda: el inquilino entrega una suma grande (en InfoCasas hay más de 400 avisos, con montos típicos de 20.000 a 45.000 dólares) y vive sin pagar alquiler; al final el dueño devuelve todo. Según el art. 1430 del Código Civil, el anticrético solo protege frente a terceros desde su inscripción en Derechos Reales. Hoy el inquilino paga primero y la inscripción llega después, si llega: ahí aparecen el doble anticrético, el falso dueño y la no devolución.

**Solución.** Con Utama, el dinero no llega al dueño hasta que el anticrético está inscrito. El inquilino deposita USDC en un escrow multi-release de Trustless Work sobre Stellar. Un verificador confirma la inscripción y se libera el pago al dueño y la comisión de Utama. Si no hay inscripción, una disputa resuelta a favor del inquilino le devuelve el depósito. La garantía queda en el escrow hasta el check-out, cuando el dueño devuelve el capital.

**Stellar como pieza central.** Un contrato Soroban propio, `utama-folios`, registra cada folio verificado (por su hash, sin datos personales) y rechaza en la cadena el doble anticrético. USDC protege a ambas partes de la devaluación del boliviano. Pollar permite entrar con Google, tener una wallet sin saber de cripto y pagar con comisiones patrocinadas.

**Modelo de negocio.** 1 % por contrato, solo si se concreta, más la verificación del folio. Los agentes inmobiliarios cobran hoy entre 2 % y 4 %.

**Estado.** Funciona en testnet con transacciones reales verificables en stellar.expert. En los próximos 30 días: firma de cada usuario con Pollar, verificador real, plan de devolución en Vaquita, mainnet y piloto en Santa Cruz.

## Descripción corta en inglés
Utama makes Bolivian "anticrético" housing deals safe. The tenant's money sits in a Stellar escrow (USDC, Trustless Work) and is released to the owner only once the contract is registered in the public property registry; otherwise it goes back to the tenant. Our own Soroban contract locks each property title on-chain and rejects double-leasing. Pollar provides Google login and an embedded wallet. Live on testnet with verifiable transactions.
