# Contrato de comportamiento — Finanzas móvil

> Complemento del contrato visual ([`mockup-manifest.js`](mockup-manifest.js) + [`index.html`](index.html)).
> El mockup dice **cómo se ve** cada pantalla y qué estados existen; este documento dice **cuándo
> aplica cada estado, qué hace cada acción y de qué dato vive la pantalla**.
> Las reglas de negocio citadas (`BR0`–`BR8`) viven en
> [`docs/project/1-business-domain.md`](../../../docs/project/1-business-domain.md), que sigue
> siendo la autoridad; aquí solo se aplican a pantallas concretas.

## Cómo se usa

- **La etapa de spec cita este documento en vez de preguntar.** Cada spec de pantalla referencia
  la sección correspondiente; una pregunta de comportamiento que este doc no responde es un vacío
  de este doc, y se resuelve agregándolo aquí (vía PR), no en una conversación efímera.
- **Marcas de confianza** por afirmación:
  - Sin marca — validado: o viene de una regla de negocio ya documentada, o LH lo validó.
  - 🟡 **propuesto** — inferido de los mockups por Claude, pendiente de validación. Una spec puede
    construir sobre él, pero debe listarlo en sus supuestos.
  - 🔴 **PENDIENTE** — decisión abierta con dueño LH. Bloquea la parte afectada del ítem hasta
    decidirse; no bloquea el resto.
- Los `screen_id`, `state_id` y rutas son exactamente los del manifest. Pantallas `mvp: false`
  (auth, presupuestos, planificación, beneficios) no aparecen aquí.

## Decisiones abiertas (índice)

| # | Decisión | Afecta | Estado |
|---|----------|--------|--------|
| D1 | Etiquetas en inglés de las 16 categorías (`design/tokens.json → categoryLabels`): escritas sin validación; el español del mockup es la ruta de producción | Seed de #3, [`settings-categories`](#settings-categories) | 🔴 urgente apenas #3 llegue a merge |
| D2 | Alcance del formato abreviado de montos (`3.7M`, `$279K`): ¿solo stat tiles y filas de categoría de `home`, o también dashboard/detalle? | [`home`](#home), [`dashboard`](#dashboard) | 🔴 |
| D3 | ¿`bank-syncing` puede continuar en segundo plano si el usuario sale de la pantalla? | [`bank-syncing`](#bank-syncing) | 🔴 |
| D4 | ¿Los bancos "Próximamente" quedan visibles (deshabilitados) en el selector, o se ocultan? | [`bank-picker`](#bank-picker) | 🔴 |
| D5 | Monitoreo de crashes/errores (clase Sentry): el estándar personal lo exige, pero enviar stacks a un servidor tensiona el principio "nada sale del dispositivo". ¿Se adopta con scrubbing probado, o se declina explícitamente? | Toda la app; ninguna pantalla en particular | 🔴 antes de la primera release |

---

## Onboarding

### onboarding-intro

- **Ruta:** `/(onboarding)/intro` · **Mockup:** `#screen=onboarding-intro`
- **Entrada:** primer arranque de la app, sin perfil creado (BR0: no hay sign-in; el perfil es el
  dispositivo). 🟡 Si ya existe perfil, la app nunca vuelve a esta pantalla.
- **Acciones:** 🟡 CTA único → `onboarding-value`.
- **Datos:** ninguno.

### onboarding-value

- **Ruta:** `/(onboarding)/value` · **Mockup:** `#screen=onboarding-value&state=step-1`
- **Estados:** `step-1` (Mejoras simples) → `step-2` (Privacidad) → `step-3` (A tu ritmo).
  🟡 Avance por swipe o CTA; el paso 3 cambia el CTA a continuar → `connect-bank-intro`.
- **Acciones:** 🟡 ¿existe "saltar"? El mockup no lo dibuja — si no está dibujado, no existe.
- **Datos:** ninguno.

### connect-bank-intro

- **Ruta:** `/(onboarding)/connect-bank` · **Mockup:** `#screen=connect-bank-intro&state=default`
- **Estados:** `default`; `how-it-works` = acordeón "¿Cómo funciona?" abierto (estado local, no
  navegación).
- **Acciones:** 🟡 CTA conectar → `bank-picker`. El copy de privacidad de este acordeón es la
  promesa central del producto (BR1) — el texto exacto sale del mockup.
- **Pendiente:** 🟡 ¿se puede posponer la conexión y entrar a la app vacía? El flujo del manifest
  sugiere que no (la conexión es parte del onboarding).

### bank-picker

- **Ruta:** `/(onboarding)/bank-picker` · **Mockup:** `#screen=bank-picker&state=list`
- **Estados:** `list` (listado completo); `search` (búsqueda con resultados); `no-results`
  (búsqueda sin coincidencias).
- **Acciones:** seleccionar banco habilitado → `bank-credentials` con la institución elegida.
- **Datos:** catálogo de instituciones (tabla `institutions`, seed de #3). En el MVP solo Banco
  de Chile está operativo.
- **Pendiente:** 🔴 **D4** — bancos "Próximamente": ¿visibles deshabilitados u ocultos?

### bank-credentials

- **Ruta:** `/(onboarding)/bank-credentials` · **Mockup:** `#screen=bank-credentials&state=empty`
- **Estados:** `empty` (inicial); `filled` (RUT + clave completos, CTA activo); `error`
  (credenciales rechazadas por el banco — el mensaje nunca incluye lo tecleado); `rut-locked`
  (segunda conexión en adelante: RUT prellenado y de solo lectura, BR2).
- **Acciones:** conectar → escribe la credencial **solo** en `expo-secure-store` y navega a
  `bank-syncing` (BR1: nunca SQLite, nunca logs, nunca payloads de error). Validación de RUT con
  dígito verificador vía `@finanzas/shared-utils` antes de habilitar el CTA.
- **Datos:** crea/actualiza la entidad *Bank connection* apuntando a la entrada del keychain.

### bank-syncing

- **Ruta:** `/(onboarding)/bank-syncing` · **Mockup:** `#screen=bank-syncing&state=login`
- **Estados:** `login` (iniciando sesión) → `products` (leyendo productos) → `transactions`
  (descargando movimientos); `error` (fallo en cualquier fase, con reintento). Los estados siguen
  el ciclo de vida de la conexión: `idle → syncing → ok | error`.
- **Acciones:** 🟡 `error` ofrece reintentar (vuelve a `login`) y volver (a `bank-credentials`
  si el fallo fue de autenticación). Reintentar es seguro siempre: la re-sincronización es
  idempotente (BR5).
- **Datos:** el scraper (`@finanzas/bank-scraper`, WebView oculto) emite productos y movimientos;
  se persisten vía upsert `(user_financial_product_id, external_id)` / `dedup_hash`.
- **Pendiente:** 🔴 **D3** — ¿continúa en segundo plano si el usuario abandona la pantalla?

### bank-connected

- **Ruta:** `/(onboarding)/bank-connected` · **Mockup:** `#screen=bank-connected&state=single`
- **Estados:** `single` (un banco conectado); `multiple` (más de uno).
- **Acciones:** 🟡 continuar → `notifications-intro`; agregar otro banco → `bank-picker`
  (con RUT bloqueado en credenciales, BR2).
- **Datos:** resumen de productos descubiertos (conteo por conexión).

### notifications-intro

- **Ruta:** `/(onboarding)/notifications` · **Mockup:** `#screen=notifications-intro&state=default`
- **Estados:** `default`; `denied` (permiso de OS denegado).
- **Acciones:** 🟡 activar → pide permiso al OS; concedido → `notifications-schedule`; denegado →
  estado `denied` con cómo habilitarlo en ajustes del sistema. Omitir → `onboarding-ready`
  (recordatorios nunca bloquean, espíritu de BR6).
- **Datos:** recordatorios **locales** (no hay backend ni push remoto).

### notifications-schedule

- **Ruta:** `/(onboarding)/notifications/schedule` · **Mockup:** `#screen=notifications-schedule&state=time`
- **Estados:** `time` (horarios preset); `custom-time` (selector libre); `days` (qué días).
- **Acciones:** 🟡 guardar → persiste en settings y programa las notificaciones locales →
  `onboarding-ready`.
- **Datos:** tabla `settings` (#3).

### onboarding-ready

- **Ruta:** `/(onboarding)/ready` · **Mockup:** `#screen=onboarding-ready`
- **Acciones:** 🟡 CTA → `stage-intro` si hay movimientos sin categorizar, o directo a
  `home` si no. Fin del onboarding: no se vuelve a entrar a `(onboarding)` salvo para agregar
  bancos desde settings.

## Categorización

### stage-intro

- **Ruta:** `/categorize/intro` · **Mockup:** `#screen=stage-intro`
- **Entrada:** desde `onboarding-ready`, desde el CTA de pendientes en `home`, o desde un
  recordatorio local.
- **Acciones:** 🟡 empezar → `categorize` con un lote acotado (el *desafío/etapa* del glosario:
  sesión corta de N movimientos, no la cola completa). Omitir → vuelve al origen sin penalidad
  (BR6).
- **Datos:** conteo de movimientos sin categoría (`category_id IS NULL` y no excluidos).
- **Pendiente:** 🟡 tamaño del lote N por sesión — el mockup no lo fija.

### categorize

- **Ruta:** `/categorize` · **Mockup:** `#screen=categorize&state=expense`
- **Estados:** `expense` (movimiento de gasto, taxonomía de gasto); `income` (ingreso, taxonomía
  de ingreso); `not-sure` ("no estoy seguro" siempre disponible, BR6); `exclude-sheet` (sheet de
  exclusión con motivo, BR3); `advanced` es `mvp: false` — la UI de inclusión parcial está
  dibujada pero **no se construye**.
- **Acciones:** elegir categoría → escribe `category_id` y avanza al siguiente del lote; omitir /
  más tarde / no estoy seguro → avanza sin escribir categoría (BR6); excluir → escribe
  `excluded_at` + motivo, nunca borra (BR3). Asignar categoría 🟡 ofrece recordar como default
  del comercio (alimenta `merchant.default_category`).
- **Datos:** movimientos pendientes + taxonomía de categorías por dirección.
- **Al agotar el lote:** → `categorize-complete`.

### merchant-edit

- **Ruta:** `/categorize/merchant/[merchantId]` · **Mockup:** `#screen=merchant-edit&state=default`
- **Estados:** `default`; `suggestions` (alias crudos sugeridos para plegar bajo este comercio);
  `category-picker` (selector de categoría default).
- **Acciones:** 🟡 renombrar comercio; aceptar/rechazar alias (un comercio pliega muchos strings
  crudos: `MERPAGO*MERCADOLIBRE`, `ML CHILE SPA`); fijar categoría default → aplica a movimientos
  futuros. 🟡 ¿Re-categoriza también los pasados no editados a mano? — **no** salvo que LH decida
  lo contrario: las decisiones del usuario nunca se pisan (principio del upsert de #3).
- **Datos:** entidad *Merchant* + sus alias.

### categorize-complete

- **Ruta:** `/categorize/complete` · **Mockup:** `#screen=categorize-complete&state=partial`
- **Estados:** `partial` (quedan pendientes fuera del lote); `done` (cola en cero).
- **Acciones:** 🟡 `partial`: otra etapa → nuevo lote en `categorize`; terminar → `home`.
  `done`: → `home`.
- **Datos:** conteo restante de pendientes.

## Tabs

### home

- **Ruta:** `/(tabs)/home` · **Mockup:** `#screen=home&state=pending`
- **Estados:** `pending` (hay movimientos por categorizar → CTA a `stage-intro`); `all-clear`
  (cola en cero); `empty` (sin datos: 🟡 conexión aún sin primer sync exitoso); `sync-error`
  (última sincronización falló → CTA a `bank-review` del banco afectado).
- **Regla dura:** todo total y gráfico usa los fragmentos compartidos `isIncluded` /
  `includedAmount` de `apps/mobile/src/db` (BR4: cuenta cuando `excluded_at IS NULL`, al valor
  `COALESCE(included_amount, amount)`). `home` y `dashboard` **no pueden** divergir: misma
  definición, un solo lugar.
- **Acciones:** 🟡 stat tile / fila de categoría → `dashboard` o `transactions` filtrado;
  CTA pendientes → `stage-intro`.
- **Datos:** agregados del mes en curso (mes por `deriveDateLocal`, nunca UTC).
- **Pendiente:** 🔴 **D2** — alcance del formato abreviado (`3.7M`, `$279K`).

### transactions

- **Ruta:** `/(tabs)/transactions` · **Mockup:** `#screen=transactions&state=list`
- **Estados:** `list`; `search` (búsqueda por texto 🟡 sobre descripción cruda y nombre de
  comercio); `filters` (🟡 por categoría, cuenta, dirección, rango de fechas); `empty` (sin
  movimientos que mostrar con el filtro activo).
- **Acciones:** fila → `transaction-detail`.
- **Datos:** listado paginado; los excluidos 🟡 se muestran atenuados (siguen existiendo, BR3),
  no desaparecen de la lista — solo salen de los totales.
- **Agrupación:** por día local (`deriveDateLocal`), montos con `formatClp`.

### transaction-detail

- **Ruta:** `/transactions/[transactionId]` · **Mockup:** `#screen=transaction-detail&state=categorized`
- **Estados:** `categorized`; `uncategorized`; `excluded` (muestra motivo y ofrece reincluir);
  `exclude-sheet` (sheet local para excluir con motivo).
- **Acciones:** cambiar categoría; editar nota; excluir (BR3) / reincluir (limpia `excluded_at`).
  Lo que dijo el banco (`raw_description`, `amount`, `type`, fecha) es **inmutable y visible**;
  lo editable es solo la capa de decisión del usuario. "Eliminar" no existe (BR3).
- **Datos:** transacción + comercio resuelto + categoría.

### dashboard

- **Ruta:** `/dashboard` · **Mockup:** `#screen=dashboard&state=month`
- **Estados:** `month` (mes en curso); `week` (semana en curso). 🟡 Navegación a períodos
  anteriores si el mockup la dibuja; si no, solo período vigente.
- **Regla dura:** misma que `home` — fragmentos compartidos BR4, sin excepción.
- **Datos:** agregados por categoría y por período; períodos en día local.
- **Pendiente:** 🔴 **D2** aplica también aquí (¿montos abreviados o completos?).

## Settings

### settings

- **Ruta:** `/settings` · **Mockup:** `#screen=settings`
- **Acciones:** hub de navegación → `settings-account`, `settings-banks`,
  `settings-notifications`, `settings-categories`, `settings-about`.

### settings-account

- **Ruta:** `/settings/account` · **Mockup:** `#screen=settings-account&state=default`
- **Estados:** `default`; `delete-confirm` (confirmación de borrado local).
- **Acciones:** 🟡 "borrar mis datos" = wipe local completo: SQLite + credenciales en
  `expo-secure-store` + settings. Es **la única** operación destructiva del producto, es local, y
  exige confirmación explícita (`delete-confirm`). Tras el wipe → `onboarding-intro`.
- **Nota:** no hay "cuenta" que cerrar en un servidor (BR0) — el copy no debe sugerir lo
  contrario.

### settings-banks

- **Ruta:** `/settings/banks` · **Mockup:** `#screen=settings-banks&state=list`
- **Estados:** `list`; `empty` (sin conexiones); `disconnect-confirm`.
- **Acciones:** agregar banco → `bank-picker`; fila → `bank-review`; desconectar → borra la
  credencial del keychain y 🟡 conserva los movimientos ya descargados (la historia es del
  usuario; desconectar corta el futuro, no borra el pasado — coherente con BR3).
- **Datos:** conexiones con su estado de sync y última fecha.

### bank-review

- **Ruta:** `/settings/banks/[bankId]` · **Mockup:** `#screen=bank-review&state=ok`
- **Estados:** `ok` (última sync exitosa); `error` (falló — 🟡 CTA reintentar, y si el fallo es
  de credenciales, re-ingresarlas vía `bank-credentials`).
- **Acciones:** 🟡 sincronizar ahora (BR5 la hace siempre segura); ver productos de la conexión.
- **Datos:** conexión + productos + resultado de la última sync.

### settings-notifications

- **Ruta:** `/settings/notifications` · **Mockup:** `#screen=settings-notifications&state=enabled`
- **Estados:** `enabled` (muestra horario/días, edita como `notifications-schedule`);
  `disabled`.
- **Datos:** settings + permiso del OS (si el OS lo revocó, manda el OS y se muestra `disabled`
  con cómo re-habilitar 🟡).

### settings-categories

- **Ruta:** `/settings/categories` · **Mockup:** `#screen=settings-categories&state=expense`
- **Estados:** `expense` / `income` (taxonomía por dirección); `edit` (renombrar/editar);
  `delete-confirm`.
- **Acciones:** crear, renombrar, borrar. Borrar re-asigna los movimientos a ✨ Otros de su
  dirección — nunca huérfanos, nunca cascada (BR7). ✨ Otros no se puede borrar ni renombrar
  🟡 (una por dirección, es el fallback del sistema; protegida además por trigger en #3).
- **Datos:** 16 categorías seed desde `design/tokens.json` + las creadas por el usuario.
- **Pendiente:** 🔴 **D1** — etiquetas en inglés de las 16 seed sin validar. El seed de #3 las
  hornea en la base de cada usuario: decidir **antes** del merge de #3.

### settings-about

- **Ruta:** `/settings/about` · **Mockup:** `#screen=settings-about`
- **Datos:** versión de la app y créditos. 🟡 Sin telemetría ni links que envíen datos — no hay
  backend.

---

## Cobertura

Toda pantalla `mvp: true` del manifest (menos las `ds-*`, que documenta el design system) tiene
sección aquí. Al agregar una pantalla al manifest, agregar su sección en el mismo PR — el
contrato visual y el de comportamiento avanzan juntos.
