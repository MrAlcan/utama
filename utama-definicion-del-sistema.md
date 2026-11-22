# Utama — Definición del sistema

> **"Utama: tu casa, sin preocupaciones."**
> *Utama* significa "tu casa" en aymara.

Documento de trabajo con todo lo definido para el proyecto: problema, solución, actores, roles, decisiones, módulos, funcionalidades, arquitectura, roadmap y alcance del MVP.

**Contexto:** proyecto para la *Stellar Bolivia 2026: National Startups Hackathon* (entrega de proyectos hasta el 22 de noviembre de 2026, anuncio de finalistas el 23 y final presencial en Santa Cruz el 27).

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Problema](#2-problema)
3. [Solución y propuesta de valor](#3-solución-y-propuesta-de-valor)
4. [Actores y roles](#4-actores-y-roles)
5. [Decisiones tomadas](#5-decisiones-tomadas)
6. [Módulos del sistema](#6-módulos-del-sistema)
7. [Flujo principal de punta a punta](#7-flujo-principal-de-punta-a-punta)
8. [Arquitectura técnica](#8-arquitectura-técnica)
9. [Modelo de negocio](#9-modelo-de-negocio)
10. [Roadmap de crecimiento](#10-roadmap-de-crecimiento)
11. [Alcance del MVP para la hackatón](#11-alcance-del-mvp-para-la-hackatón)
12. [Pitch](#12-pitch)
13. [Riesgos y temas abiertos](#13-riesgos-y-temas-abiertos)
14. [Glosario](#14-glosario)

---

## 1. Resumen ejecutivo

**Utama** es una plataforma sobre la red **Stellar** que da confianza a los contratos de **anticrético** (y, más adelante, de alquiler con garantía) en Bolivia.

- **Verifica el inmueble** antes de firmar: Folio Real, identidad del dueño, gravámenes y fotos reales.
- **Impide el doble anticrético**: el folio queda bloqueado on-chain mientras haya un contrato activo.
- **Protege el dinero**: un fondo de garantía queda en un contrato inteligente y se libera solo tras el check-out.
- **Ayuda al dueño a devolver**: un plan de devolución con aportes mensuales.
- **Construye reputación** de inquilinos y dueños, incluido el historial de ahorro en Vaquita.
- **Funciona como marketplace** de inmuebles verificados, como un "Airbnb de anticréticos".

**Mercado de entrada:** anticrético de vivienda en Bolivia.
**Visión:** locales, oficinas y galpones; crédito; garantías de alquiler en Latinoamérica.

---

## 2. Problema

Las dos partes tienen miedo, y los dos lados pesan igual.

### Miedos del inquilino
- Que el dueño **no le devuelva el dinero** al final del contrato.
- Que quien firma **no sea el dueño real** del inmueble.
- El **doble anticrético**: el mismo inmueble entregado a dos personas.
- Que el inmueble tenga **hipotecas o embargos**.
- **Devaluación:** si se pacta en bolivianos, al final recibe un dinero que vale menos.
- **Escasez de dólares:** si se pacta en dólares, el dueño puede no tenerlos al final.
- Reclamar por la vía judicial puede tardar años.

### Miedos del dueño
- Que el inquilino **dañe el inmueble**.
- Que el inquilino **no se vaya** al terminar el plazo.
- Que el inquilino **no cumpla** lo pactado.

### Usuarios con el problema
- Personas que **se mudan a una ciudad nueva** (jóvenes que se independizan, familias, estudiantes).
- **Extranjeros que llegan** a Bolivia y **bolivianos que se van** o que viven en el exterior.
- **Emprendedores** que buscan un local u oficina.

---

## 3. Solución y propuesta de valor

> El anticrético se pacta con reglas claras, el inmueble se verifica antes de firmar, una parte del dinero queda protegida en un contrato inteligente, el dueño va juntando la devolución mes a mes y el dinero del inquilino se libera tras un check-out conforme.

### Para el inquilino
- Inmueble y dueño verificados.
- Fondo de garantía protegido en escrow.
- Seguimiento del plan de devolución del dueño.
- Imposibilidad de doble anticrético dentro de la plataforma.
- Reputación portable (pasaporte de inquilino).

### Para el dueño
- **Dispone del dinero** del anticrético (la mayor parte al instante).
- Inquilinos verificados con identidad y reputación.
- Más visibilidad y un cierre más rápido.
- Protección ante daños con inventario, check-in y check-out.
- Acceso a inquilinos del extranjero que pagan en USDC.
- Préstamo puente si al final no junta la devolución (roadmap).

---

## 4. Actores y roles

### 4.1 Actores principales (usuarios de la plataforma)

| Actor | Rol | Qué puede hacer |
|---|---|---|
| **Inquilino** (anticresista) | Toma el inmueble y entrega el dinero | Buscar inmuebles, agendar visitas, negociar, pagar, hacer check-in y check-out, calificar al dueño, ver el plan de devolución, solicitar crédito (roadmap) |
| **Dueño** (propietario) | Ofrece el inmueble y recibe el dinero | Verificar el folio, publicar, definir reglas, aceptar o negociar ofertas, recibir el pago, aportar al plan de devolución, aprobar o reclamar en el check-out, calificar al inquilino |
| **Agente inmobiliario** (opcional) | Intermediario verificado | Publicar inmuebles de sus clientes, gestionar visitas, cobrar su comisión automáticamente al cerrar el trato |
| **Agente verificador** (opcional) | Prestador de servicios | Visitar inmuebles (insignia "Inmueble visitado"), hacer check-in y check-out presenciales, cobrar por servicio |
| **Aval** | Usuario que respalda a otro | Respaldar a un usuario nuevo para que suba de nivel más rápido |
| **Inversionista / prestamista** (roadmap) | Pone el dinero para los préstamos | Depositar USDC en Utama Invierte y recibir intereses |

### 4.2 Actores internos

| Actor | Rol |
|---|---|
| **Administrador de la plataforma** | Gestiona usuarios, reglas recomendadas, reportes y configuración |
| **Equipo de verificación** | Revisa manualmente los documentos que la IA marca como dudosos (verificación mixta) |
| **Mediador** (propuesto) | Interviene en disputas que las reglas pactadas no resuelven |

### 4.3 Sistemas externos

| Sistema | Relación con Utama |
|---|---|
| **Red Stellar / Soroban** | Contratos inteligentes, escrow, bloqueo de folio, reputación |
| **USDC en Stellar** | Moneda del escrow y de los pagos en dólares |
| **Anchor / exchange** | Conversión entre bolivianos y USDC |
| **Vaquita** | Fuente de historial de ahorro para la reputación |
| **Blend** (roadmap) | Rendimiento del fondo de garantía y del plan de devolución, préstamos |
| **Derechos Reales (DD.RR.)** | Registro oficial. **No hay integración**: Utama solo lee los documentos que suben los usuarios y recomienda la inscripción |
| **Cooperativas / entidades reguladas** (roadmap) | Otorgan los préstamos de Utama Crédito |

---

## 5. Decisiones tomadas

| # | Tema | Decisión |
|---|---|---|
| D1 | Usuario principal | Inquilino y dueño **por igual** |
| D2 | Uso del dinero | El **dueño dispone del dinero** del anticrético |
| D3 | Protección de la devolución | **Fondo de garantía parcial**: el dueño recibe al instante el 80-90 % y el 10-20 % queda bloqueado hasta el check-out. El porcentaje es una **regla configurable** |
| D4 | Moneda | **Sugerida según residencia**: dólares (USDC) si la persona vive en el extranjero, bolivianos si vive en Bolivia. El usuario puede cambiarla |
| D5 | Forma de pago | El usuario elige **USDC o bolivianos**. Si paga en bolivianos, la plataforma convierte a USDC lo que va al escrow |
| D6 | Reglas | Cada inmueble tiene **reglas por categorías**, con plantillas **Flexible / Moderada / Estricta** |
| D7 | Reglas de la plataforma | La plataforma propone **reglas recomendadas**. El dueño puede aceptarlas o no; si las acepta, gana el **sello "Reglas recomendadas"** y más visibilidad |
| D8 | Renovación | Se renueva si **ambas partes aceptan** las condiciones, con opción de **negociarlas en la plataforma** (o verbalmente, dejando el acuerdo por escrito) |
| D9 | Conflictos | **Check-in y check-out con inventario inicial**. Si al salir todo está conforme, se libera la garantía; si no, se aplican las **reglas de daños** pactadas |
| D10 | Inquilino que no se va | Su dinero **no se libera hasta el check-out**. Si persiste: penalidades pactadas, baja de reputación y vía legal |
| D11 | Documentos requeridos | **Folio Real** y **documento de identidad del dueño** |
| D12 | Verificación de documentos | **Mixta**: IA más revisión humana |
| D13 | Fotos | Tomadas **desde la cámara de la app**, con ubicación y fecha |
| D14 | Derechos Reales | **La plataforma no inscribe.** Recomienda la inscripción con una guía; el comprobante (folio actualizado) es **opcional** y otorga la insignia "Inscrito en DD.RR." |
| D15 | Usuarios nuevos | Sistema de **niveles** que permite a un usuario nuevo verificado acceder a un anticrético |
| D16 | Reputación | Se calcula con **todas las fuentes en conjunto**, para inquilinos y dueños |
| D17 | Préstamos | Sección **Utama Crédito** (roadmap), otorgados por **entidades reguladas aliadas** |
| D18 | Otra cara de la plataforma | **Utama Invierte**: inversionistas e incluso la diáspora aportan liquidez (roadmap) |
| D19 | Requisitos para publicar | **Registro completo**: folio verificado, identidad, fotos, inventario, reglas y condiciones |
| D20 | Agentes | **Trato directo** como base; agentes como rol opcional y oportunidad de negocio |
| D21 | Visitas | **Calendario** integrado y didáctico |
| D22 | Expansión | Además de vivienda: **locales, oficinas, pisos, galpones y habitaciones** |
| D23 | Nombre | **Utama** (dominio por definir: utama.bo, utamaapp.com, getutama.com) |

---

## 6. Módulos del sistema

Resumen:

| Módulo | Nombre | MVP |
|---|---|---|
| M1 | Identidad y cuentas |
| M2 | Verificación de inmuebles
| M3 | Marketplace y publicaciones 
| M4 | Reglas y condiciones 
| M5 | Visitas y calendario 
| M6 | Negociación y contrato |
| M7 | Pagos y conversión 
| M8 | Contrato inteligente (escrow) 
| M9 | Check-in, check-out e inventario 
| M10 | Resolución de conflictos
| M11 | Reputación y niveles 
| M12 | Derechos Reales 
| M13 | Agentes inmobiliarios 
| M14 | Utama Crédito 
| M15 | Utama Invierte 
| M16 | Notificaciones y paneles 
| M17 | Administración 


---

### M1 — Identidad y cuentas

**Objetivo:** que cada usuario sea una persona real y verificada.

**Funcionalidades**
- Registro con correo o teléfono.
- Verificación de identidad: foto del CI o pasaporte más una **selfie**.
- Wallet Stellar integrada, idealmente con **passkeys** (huella o Face ID, sin frase semilla).
- Selección de rol: inquilino, dueño o ambos (un mismo usuario puede tener los dos roles).
- Registro del **país de residencia**, que define la moneda sugerida (D4).
- Perfil público con nivel, insignias y calificaciones.

**Reglas**
- Sin identidad verificada no se puede publicar ni tomar un anticrético.
- Para publicar, el titular del folio debe coincidir con el CI del dueño (ver M2).

---

### M2 — Verificación de inmuebles

**Objetivo:** confirmar que el inmueble existe, que quien lo ofrece es el dueño y que está libre de gravámenes.

**Documentos requeridos (D11)**
- **Folio Real** actualizado de Derechos Reales.
- **Documento de identidad** del dueño.

**Verificación en 3 capas**

1. **Antes de publicar: revisión del registro oficial**
   - La IA extrae del folio: número de folio, titular, ubicación, superficie, y si hay hipotecas, embargos o anticréticos inscritos.
   - Se valida que el titular coincida con el CI del dueño.
   - Si el documento trae código de verificación o QR, se valida contra la fuente oficial.
   - Lo que la IA marca como dudoso pasa a revisión humana (D12).
   - **Si hay un anticrético o una hipoteca inscrita, se rechaza.**
   - El folio debe ser reciente (propuesta: emitido hace menos de 30 días).

2. **Al firmar: bloqueo on-chain**
   - El número de folio se normaliza (sin puntos ni espacios) y se guarda como **hash** en el contrato inteligente.
   - Mientras haya un contrato activo, **no se puede crear otro con el mismo folio**.
   - Al finalizar el contrato, el folio se libera.

3. **Después de firmar: inscripción en Derechos Reales** (ver M12)
   - Cierra el hueco de un doble anticrético hecho "por fuera" de la plataforma.

**Verificación de fotos (D13)**
- Fotos tomadas **solo desde la cámara de la app**, con ubicación y fecha automáticas.
- La ubicación debe coincidir con la del inmueble.
- Revisión con IA para detectar fotos sacadas de internet.
- Opcional: visita de un agente verificador (insignia **"Inmueble visitado"**).

**Privacidad**
- Los documentos **no se suben a la blockchain**. Se guardan cifrados fuera de la cadena; on-chain solo va el hash y el resultado de la verificación.

**Casos particulares**
- Departamentos en propiedad horizontal: cada uno tiene su propio folio.
- Escalabilidad internacional: identificador genérico `país + registro + número de inmueble`, con un adaptador de lectura por país.

---

### M3 — Marketplace y publicaciones

**Objetivo:** que los inquilinos encuentren inmuebles verificados, como en Airbnb.

**Requisito para publicar (D19):** registro completo con folio verificado, identidad, fotos desde la app, inventario, reglas y condiciones.

**Tipos de inmueble (D22)**

| Tipo | Datos específicos |
|---|---|
| 🏠 Casa / departamento | Dormitorios, baños, amoblado, mascotas |
| 🏢 Piso completo / edificio | Número de unidades, ascensor, uso mixto |
| 🏪 Local comercial | Flujo de personas, frente a la calle, rubros permitidos, licencia de funcionamiento |
| 💼 Oficina | m², parqueos, internet, sala de reuniones, horario de acceso |
| 🏭 Galpón / depósito | Altura, acceso para camiones, energía trifásica, seguridad |
| 🛏️ Habitación / estudiantes | Baño propio o compartido, servicios incluidos, universidad cercana |

**Tipos de contrato**
- **Anticrético** (base).
- **Alquiler mensual con garantía** (el depósito va al escrow).
- **Mixto:** anticrético más un alquiler mensual reducido.

**Ficha del inmueble**
- Fotos, zona y barrio con un mapa aproximado, m², ambientes, servicios y extras.
- **Monto** en USDC o bolivianos, **plazo** (1, 2 o 3 años) y condiciones.
- Insignias: ✅ Folio verificado · ✅ Dinero protegido · ✅ Reglas recomendadas · ✅ Inmueble visitado.
- Reputación del dueño.
- **Estado:** "Disponible" o "En anticrético hasta [fecha]" (leído del bloqueo on-chain).

**Búsqueda:** filtros por ciudad, zona, tipo de inmueble, tipo de contrato, monto, plazo y características.

**Privacidad:** la dirección exacta y el número de folio completo **no son públicos**; la dirección se revela solo a inquilinos verificados con visita agendada.

---

### M4 — Reglas y condiciones

**Objetivo:** que todo lo que puede generar un conflicto esté pactado de antemano.

**Categorías de reglas (D6)**

| Categoría | Ejemplos |
|---|---|
| Salida anticipada del inquilino | Preaviso, penalidad, plazo de devolución |
| Recuperación anticipada por el dueño | Preaviso, compensación |
| Daños y descuentos | Qué se descuenta de la garantía y cómo se valora |
| Renovación | Condiciones para renovar y cómo se negocia |
| Fondo de garantía | Porcentaje bloqueado (10-20 %) |
| Plan de devolución | Aporte mensual del dueño |
| Convivencia | Mascotas, visitas, ruido |
| Servicios y expensas | Quién paga qué |
| **Negocios** | Remodelaciones, mejoras, rubro permitido, subalquiler, horarios |

**Plantillas:** cada categoría ofrece **Flexible / Moderada / Estricta**, como las políticas de cancelación de Airbnb.

**Reglas recomendadas por la plataforma (D7)**
- La plataforma sugiere una configuración equilibrada.
- El dueño puede aceptarla o personalizarla.
- Si la acepta: **sello "Reglas recomendadas"** y mayor visibilidad en el marketplace.

---

### M5 — Visitas y calendario

**Objetivo:** que agendar una visita sea simple (D21).

**Funcionalidades**
- El dueño (o su agente) define su **disponibilidad** en un calendario.
- El inquilino verificado **reserva** un horario.
- **Confirmación y recordatorios** automáticos.
- Guía didáctica: qué revisar durante la visita y qué preguntar.
- Tras reservar se revela la dirección exacta.

---

### M6 — Negociación y contrato

**Objetivo:** que el acuerdo final quede claro y por escrito.

**Funcionalidades**
- **Chat** entre inquilino y dueño.
- **Contraoferta formal:** el inquilino propone otro monto, plazo o reglas, y el dueño acepta, rechaza o contrapropone.
- Si se negoció de forma verbal, el acuerdo se deja **registrado en la plataforma** (D8).
- Generación del **resumen del contrato**: partes, inmueble, monto, moneda, plazo, reglas, porcentaje de garantía y plan de devolución.
- **Firma digital** de ambas partes, que dispara la creación del contrato inteligente (M8).

---

### M7 — Pagos y conversión

**Objetivo:** que pagar sea fácil, en la moneda de cada usuario.

**Opciones de pago (D5)**
- **USDC:** directo desde la wallet.
- **Bolivianos:** la plataforma convierte a USDC a través de un anchor o exchange (por ejemplo, con un QR bancario). En el MVP, simulado.

**Reparto del pago (D3)**
- **80-90 %** → al dueño, al instante (en USDC, o en bolivianos si así lo eligió).
- **10-20 %** → al **fondo de garantía** del contrato inteligente, siempre en USDC.
- Si hay agente: su **comisión se paga automáticamente** desde el contrato (M13).
- Comisión de la plataforma (ver sección 9).

**Nota técnica:** no se encontró una stablecoin de bolivianos en uso en Stellar. Por eso el escrow se guarda en USDC; como es una parte pequeña del monto, el riesgo de tipo de cambio es bajo.

---

### M8 — Contrato inteligente (escrow) en Soroban

**Objetivo:** el núcleo de confianza del sistema.

**Datos del contrato**
- Inquilino, dueño, agente (opcional).
- Hash del folio.
- Monto total, moneda pactada, porcentaje de garantía.
- Fechas de inicio y vencimiento.
- Plan de devolución (aporte mensual y saldo acumulado).
- Estado: `activo`, `en_checkout`, `en_disputa`, `finalizado`, `renovado`.

**Funciones**

| Función | Qué hace |
|---|---|
| `crear_anticretico` | Valida que el folio no tenga un contrato activo, recibe el pago, reparte (dueño / garantía / comisiones) y **bloquea el folio** |
| `aportar_devolucion` | El dueño aporta su cuota mensual al plan de devolución |
| `estado_devolucion` | Muestra cuánto lleva ahorrado el dueño frente a lo que debe devolver |
| `iniciar_checkout` | Al vencer o ante una salida anticipada, abre el proceso de check-out |
| `aprobar_checkout` | Si todo está conforme, libera la garantía y la devolución al inquilino, y **libera el folio** |
| `reclamar_danos` | El dueño reclama daños según las reglas pactadas; el monto se descuenta de la garantía |
| `abrir_disputa` | Si no hay acuerdo, el contrato pasa a disputa (ver M10) |
| `renovar` | Ambas partes aceptan nuevas condiciones y el contrato continúa sin devolver y volver a depositar |
| `salida_anticipada` | Aplica las reglas pactadas de salida anticipada |

**Regla clave:** el dinero del inquilino **solo se libera tras el check-out** (D10).

**Rendimiento (roadmap):** el fondo de garantía y el ahorro del plan de devolución pueden generar intereses en Blend, repartidos según las reglas.

---

### M9 — Check-in, check-out e inventario

**Objetivo:** evitar discusiones al final del contrato (D9).

**Check-in (al entrar)**
- El dueño publica el **inventario inicial**: fotos de cada ambiente y estado de muebles, artefactos y acabados.
- El inquilino revisa y puede agregar observaciones.
- **Ambos firman** el inventario. Su hash queda registrado on-chain.

**Check-out (al salir)**
- Se toman nuevas fotos desde la app.
- El dueño compara contra el inventario inicial.
- **Conforme:** se libera el dinero y el folio.
- **No conforme:** se aplican las reglas de daños (M4) y, si no hay acuerdo, se abre una disputa (M10).

**Opcional:** check-in y check-out presenciales con un agente verificador.

---

### M10 — Resolución de conflictos

**Objetivo:** que cada conflicto tenga un camino definido.

| Conflicto | Cómo se resuelve |
|---|---|
| Daños al inmueble | Comparación con el inventario y reglas de daños pactadas; el descuento sale del fondo de garantía |
| Inquilino que no se va | Su dinero no se libera; penalidades pactadas, baja de reputación y vía legal |
| Dueño que no junta la devolución | Alertas del plan de devolución, baja de reputación y préstamo puente (roadmap) |
| Salida o recuperación anticipada | Reglas pactadas de cada categoría |
| Desacuerdo sin regla aplicable | Escalamiento a un **mediador** de la plataforma (propuesto) |

---

### M11 — Reputación y niveles

**Objetivo:** confianza basada en el historial, sin dejar fuera a los nuevos (D15, D16).

**Niveles**
🆕 Nuevo verificado → 🥉 Bronce → 🥈 Plata → 🥇 Oro

- Un usuario nuevo **no empieza con cero estrellas**: empieza como "Nuevo verificado", con su identidad confirmada, y **puede acceder a un anticrético**.

**Fuentes de reputación**

| Inquilino | Dueño |
|---|---|
| Anticréticos cumplidos | Devoluciones a tiempo |
| Check-outs conformes | Cumplimiento del plan de devolución |
| Calificaciones de dueños | Calificaciones de inquilinos |
| Historial de ahorro en **Vaquita** | Exactitud de la publicación |
| Aval de otro usuario | Insignia "Inscrito en DD.RR." |
| Comprobantes de ingresos (opcional) | |

**Pasaporte de inquilino:** la reputación queda on-chain y es **portable**, también entre países (roadmap internacional).

---

### M12 — Derechos Reales

**Objetivo:** reforzar la protección legal sin que la plataforma haga trámites (D14).

**Funcionalidades**
- **Guía paso a paso** para inscribir el anticrético en Derechos Reales.
- Recomendación de notarios aliados (opcional).
- Carga **opcional** del folio actualizado donde figura el anticrético inscrito.
- Si se sube: insignia **"Inscrito en DD.RR."** en el contrato y más reputación para ambas partes.

---

### M13 — Agentes inmobiliarios (roadmap)

**Objetivo:** sumar inmuebles rápido y crear una nueva fuente de ingresos (D20).

**Funcionalidades**
- **Agente verificado:** publica inmuebles de sus clientes, que pasan por la misma verificación.
- **Comisión automática:** se paga directo desde el contrato inteligente al cerrar el trato.
- **Agente verificador:** visitas, check-in y check-out presenciales, cobro por servicio.
- **Plan para agentes:** suscripción con más publicaciones y visibilidad.

---

### M14 — Utama Crédito (roadmap)

**Objetivo:** convertir la confianza en acceso a crédito (D17).

**Dónde aparece**
- **Al tomar un anticrético:** "¿Te falta una parte? Financia la diferencia."
- **En el panel del dueño, cerca del vencimiento:** "Tu plan de devolución va al 60 %. Solicita un préstamo puente."
- **En el perfil:** el nivel muestra cuánto crédito puede recibir el usuario.

**Tipos de préstamo**
- **Inquilino:** completar el monto del anticrético, mudanza, amoblar.
- **Dueño:** **préstamo puente** para devolver el anticrético.
- **Emprendedor:** equipar un local u oficina.

**Respaldo:** fondo de garantía, reputación e historial de Vaquita.

**Quién presta:** cooperativas o entidades reguladas aliadas. Utama aporta el scoring y la verificación; **no presta directamente** (regulación de la ASFI).

---

### M15 — Utama Invierte (roadmap)

**Objetivo:** la otra cara de la plataforma: quién pone el dinero de los préstamos (D18).

**Funcionalidades**
- Cooperativas y entidades reguladas como fuente principal.
- Más adelante: **pool de liquidez en USDC** donde personas depositan y ganan intereses.
- La **diáspora boliviana** puede invertir en vivienda en Bolivia desde el exterior.

Con este módulo, Utama tiene **tres lados**: inquilinos, dueños e inversionistas.

---

### M16 — Notificaciones y paneles

**Panel del inquilino:** contratos activos, estado del plan de devolución del dueño, próximas visitas, nivel y reputación.

**Panel del dueño:** inmuebles publicados, ofertas, contratos activos, avance del plan de devolución, check-outs pendientes.

**Notificaciones:** nuevas ofertas, visitas agendadas, aportes pendientes del plan de devolución, vencimientos próximos, check-out, disputas.

---

### M17 — Administración (roadmap)

- Gestión de usuarios y reportes.
- Cola de verificación manual de documentos.
- Configuración de reglas recomendadas y plantillas.
- Gestión de mediaciones.
- Métricas de la plataforma.

---

## 7. Flujo principal de punta a punta

```
DUEÑO                                   INQUILINO
─────                                   ─────────
1. Se registra y verifica identidad     1. Se registra y verifica identidad
2. Sube Folio Real y CI                          │
3. Verificación mixta (IA + humano)              │
4. Toma fotos desde la app                       │
5. Carga inventario, reglas y condiciones        │
6. Publica el inmueble ───────────────► 2. Busca y encuentra el inmueble
                                        3. Agenda una visita (calendario)
                                        4. Visita el inmueble
7. Recibe la oferta ◄────────────────── 5. Hace una oferta o contraoferta
8. Acepta o negocia ──────────────────► 6. Acuerdo final
9. Firma digital ◄────────────────────► 7. Firma digital
                    │
          CONTRATO INTELIGENTE (Soroban)
          • Verifica que el folio esté libre
          • Recibe el pago (USDC o Bs convertidos)
          • 80-90 % → dueño
          • 10-20 % → fondo de garantía
          • Bloquea el folio
                    │
10. Check-in: ambos firman el inventario inicial
                    │
11. Durante el contrato:
    • El dueño aporta mensualmente al plan de devolución
    • El inquilino ve el avance
    • (Opcional) inscripción en DD.RR. e insignia
                    │
12. Vencimiento → ¿renovar?
    ├── Sí: nuevas condiciones aceptadas por ambos → el contrato continúa
    └── No: check-out
                    │
13. Check-out: comparación con el inventario
    ├── Conforme → se devuelve el dinero al inquilino y se libera el folio
    └── No conforme → reglas de daños → (si no hay acuerdo) mediación
                    │
14. Calificación mutua → actualización de la reputación
```

---

## 8. Arquitectura técnica

### 8.1 Qué va on-chain y qué off-chain

| On-chain (Stellar / Soroban) | Off-chain (backend de Utama) |
|---|---|
| Contrato de anticrético (escrow) | Documentos cifrados (folio, CI) |
| Bloqueo del folio (hash) | Fotos del inmueble y del inventario |
| Fondo de garantía en USDC | Datos de la publicación (descripción, características) |
| Plan de devolución | Chat y negociación |
| Hash del inventario firmado | Calendario de visitas |
| Hash y resultado de la verificación | Motor de IA de lectura de documentos |
| Reputación e insignias | Cálculo de la reputación (con datos on-chain) |
| Comisiones automáticas | Notificaciones |

### 8.2 Componentes de Stellar
- **Soroban:** contratos inteligentes en Rust.
- **USDC en Stellar:** moneda del escrow.
- **Stellar Asset Contract (SAC):** uso de USDC desde los contratos.
- **Passkeys / smart wallets:** acceso sin frase semilla.
- **Anchors (SEP-24 / SEP-31) y autenticación (SEP-10 / SEP-45):** conversión entre bolivianos y USDC.
- **Multifirma** (opcional): aprobación de check-out o mediación.
- **Vaquita:** lectura del historial de ahorro on-chain (a confirmar con su equipo).
- **Blend** (roadmap): rendimiento y préstamos.

### 8.3 Componentes off-chain
- **Frontend:** web o app móvil (marketplace, fichas, paneles, cámara).
- **Backend:** API, base de datos, almacenamiento cifrado de documentos y fotos.
- **IA:** extracción de datos del Folio Real y del CI, y detección de fotos falsas.
- **Cola de revisión manual** para la verificación mixta.

---

## 9. Modelo de negocio

| Fuente de ingresos | Descripción |
|---|---|
| Comisión por contrato | Un porcentaje pequeño por cada anticrético creado |
| Verificación del folio | Cobro por la verificación del inmueble |
| Rendimiento | Parte del rendimiento del fondo de garantía y del plan de devolución (roadmap) |
| Agentes | Suscripción y comisión por los servicios de verificación (roadmap) |
| Crédito | Comisión por los préstamos originados con entidades aliadas (roadmap) |
| Inversión | Comisión de gestión en Utama Invierte (roadmap) |
| Visibilidad | Publicaciones destacadas |

---

## 10. Roadmap de crecimiento

| Etapa | Qué es | Dónde |
|---|---|---|
| **1. MVP (hackatón)** | Anticrético seguro: verificación del folio, escrow en USDC, bloqueo del doble anticrético, check-in y check-out | Bolivia |
| **2. Marketplace** | Inmuebles verificados con reputación de dueños e inquilinos; calendario; reglas recomendadas | Bolivia |
| **3. Expansión de inmuebles** | Locales, oficinas, pisos, galpones, habitaciones; alquiler con garantía y contratos mixtos | Bolivia |
| **4. Crédito e inversión** | Utama Crédito y Utama Invierte, con entidades reguladas y Vaquita | Bolivia |
| **5. Internacional** | Pasaporte de inquilino; escrow de garantías para bolivianos que se mudan y para la diáspora que alquila en Bolivia desde afuera | Latinoamérica y España |

**Mensaje:** Bolivia es el mercado de entrada, no el límite.

---

## 11. Alcance del MVP para la hackatón

### Construir (funcional)
- **Contrato inteligente en Soroban:** `crear_anticretico` (con reparto dueño / garantía), bloqueo del folio, `aprobar_checkout` y liberación del folio.
- **Demo del doble anticrético:** intentar crear un segundo contrato con el mismo folio y mostrar el rechazo: *"Este inmueble ya tiene un anticrético activo."*
- **Lectura del Folio Real con IA:** extraer titular y gravámenes, y guardar el hash on-chain.
- **Pantalla de listado** con 3 a 5 inmuebles de ejemplo, fotos, insignias y **selector de categorías** (Vivienda, Local, Oficina, Galpón).
- **Ficha del inmueble** con el botón "Tomar en anticrético".
- **Flujo de pago en USDC** conectado al contrato real (testnet).
- **Check-in y check-out básico** con inventario.

### Simular o mostrar en el pitch
- Conversión de bolivianos a USDC.
- Calendario de visitas y negociación.
- Plan de devolución (puede ser una función simple o mostrarse en pantalla).
- Reputación con el historial de Vaquita (datos de ejemplo o testnet).
- Utama Crédito, Utama Invierte, agentes y expansión internacional → **slides del roadmap**.

---

## 12. Pitch

**Slogan principal:** *"Utama: tu casa, sin preocupaciones."*
**Variante para la expansión:** *"Tu espacio, sin preocupaciones."*
**Frase sobre la tecnología:** *"Utama usa la blockchain como un kipu moderno: un registro de confianza que nadie puede borrar."*

**Estructura (2-3 minutos)**
1. **Historia (20 s):** "María se mudó a Santa Cruz y entregó todos sus ahorros en anticrético. Al terminar el contrato, el dueño no tenía el dinero para devolvérselo."
2. **Dolor (20 s):** miedos del inquilino y del dueño, devaluación y escasez de dólares.
3. **Solución (30 s):** verificación, fondo de garantía, plan de devolución, check-out.
4. **Demo (60 s):** verificación del folio → pago → bloqueo del folio → intento de doble anticrético rechazado → check-out y devolución.
5. **Visión (20 s):** locales y oficinas, crédito con Vaquita, Latinoamérica.
6. **Cierre:** *"Utama: tu casa, sin preocupaciones."*

**Cómo encaja en los pilares de la hackatón**
- **Usa Stellar:** pagos, stablecoins (USDC), tokenización de garantías e identidad.
- **Integra el ecosistema:** Vaquita (reputación) y, más adelante, Blend.
- **Resuelve algo real:** el riesgo del anticrético, un problema muy boliviano.
- **Llega a fondeo:** modelo de negocio claro y roadmap de startup.

---

## 13. Riesgos y temas abiertos

| Tema | Estado / mitigación |
|---|---|
| Porcentaje de garantía por defecto | Por definir (propuesta: 10-20 %, configurable) |
| Validez legal del contrato inteligente | Usarlo como complemento del contrato tradicional; recomendar el contrato notariado y la inscripción en DD.RR. |
| Documentos falsos | Verificación mixta, códigos de verificación, folio reciente |
| Doble anticrético fuera de la plataforma | Recomendación de inscripción en DD.RR. e insignia |
| Regulación de préstamos (ASFI) | Préstamos solo a través de entidades reguladas |
| Stablecoin de bolivianos | No se encontró una en uso en Stellar; el escrow va en USDC |
| Conversión bolivianos ↔ USDC | Requiere un anchor o exchange aliado |
| Datos de Vaquita | Confirmar con su equipo cómo exponerlos |
| Adopción por parte de los dueños | Beneficios claros: dispone del dinero, inquilinos verificados, visibilidad |
| Competencia | Ya hay demanda de plataformas de anticrético en Bolivia; el diferencial es la verificación, el escrow y la reputación on-chain |
| Dominio | utama.com probablemente ocupado; evaluar utama.bo, utamaapp.com, getutama.com |
| Mediación de disputas | Definir quién actúa como mediador y con qué reglas |

---

## 14. Glosario

| Término | Definición |
|---|---|
| **Anticrético** | Contrato en el que el inquilino entrega una suma al dueño a cambio de usar el inmueble; al terminar, el dueño devuelve la suma completa |
| **Folio Real** | Ficha del inmueble en Derechos Reales con su titular e historial de gravámenes |
| **Derechos Reales (DD.RR.)** | Registro oficial de la propiedad inmueble en Bolivia |
| **Gravamen** | Carga sobre el inmueble: hipoteca, embargo, anticrético inscrito |
| **Doble anticrético** | Fraude en el que el mismo inmueble se entrega en anticrético a dos personas |
| **Escrow** | Dinero retenido por un tercero (aquí, un contrato inteligente) hasta que se cumplan condiciones |
| **Fondo de garantía** | Parte del pago (10-20 %) bloqueada en el contrato hasta el check-out |
| **Plan de devolución** | Aportes mensuales del dueño para juntar el monto a devolver |
| **Check-in / check-out** | Registro del estado del inmueble al entrar y al salir |
| **Stellar** | Red blockchain para pagos y activos digitales |
| **Soroban** | Plataforma de contratos inteligentes de Stellar |
| **USDC** | Stablecoin equivalente al dólar estadounidense |
| **Anchor** | Entidad que convierte dinero tradicional en activos de Stellar y viceversa |
| **Vaquita** | Protocolo de ahorro comunitario (tipo pasanaku) en el ecosistema Stellar |
| **Blend** | Protocolo de préstamos y rendimiento en Stellar |
| **Passkey** | Acceso con huella o Face ID, sin contraseñas ni frase semilla |
| **Kipu** | Sistema andino de registro con cuerdas y nudos; metáfora de la blockchain |
