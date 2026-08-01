# Inventory — `mobile`

36 screens · `$status: complete` · tokens v1.0.0

Legend: **MVP** = part of the development MVP · **—** = mockup only (`mvp: false` in the manifest).

---

## Auth · fuera del MVP

| screen_id | route | states | MVP |
|-----------|-------|--------|-----|
| `auth` | `/(auth)/sign-in` | empty · email-typed | — |
| `verify-code` | `/(auth)/verify-code` | empty · filled · invalid · resend-ready | — |

## Onboarding

| screen_id | route | states | MVP |
|-----------|-------|--------|-----|
| `onboarding-intro` | `/(onboarding)/intro` | — | ✅ |
| `onboarding-value` | `/(onboarding)/value` | step-1 · step-2 · step-3 | ✅ |
| `connect-bank-intro` | `/(onboarding)/connect-bank` | default · how-it-works | ✅ |
| `bank-picker` | `/(onboarding)/bank-picker` | list · search · no-results | ✅ |
| `bank-credentials` | `/(onboarding)/bank-credentials` | empty · filled · error · rut-locked | ✅ |
| `bank-syncing` | `/(onboarding)/bank-syncing` | login · products · transactions · error | ✅ |
| `bank-connected` | `/(onboarding)/bank-connected` | single · multiple | ✅ |
| `notifications-intro` | `/(onboarding)/notifications` | default · denied | ✅ |
| `notifications-schedule` | `/(onboarding)/notifications/schedule` | time · custom-time · days | ✅ |
| `onboarding-ready` | `/(onboarding)/ready` | — | ✅ |

## Categorización

| screen_id | route | states | MVP |
|-----------|-------|--------|-----|
| `stage-intro` | `/categorize/intro` | — | ✅ |
| `categorize` | `/categorize` | expense · income · not-sure · advanced · exclude-sheet | ✅ |
| `merchant-edit` | `/categorize/merchant/[merchantId]` | default · suggestions · category-picker | ✅ |
| `categorize-complete` | `/categorize/complete` | partial · done | ✅ |

## App

| screen_id | route | states | MVP |
|-----------|-------|--------|-----|
| `home` | `/(tabs)/home` | pending · all-clear · empty · sync-error | ✅ |
| `transactions` | `/(tabs)/transactions` | list · search · filters · empty | ✅ |
| `transaction-detail` | `/transactions/[transactionId]` | categorized · uncategorized · excluded · exclude-sheet | ✅ |
| `dashboard` | `/dashboard` | month · week | ✅ |

## Presupuestos · Planificación

| screen_id | route | states | MVP |
|-----------|-------|--------|-----|
| `budgets` | `/(tabs)/budgets` | empty · active | — |
| `budget-create` | `/budgets/new` | empty · filled | — |
| `planning` | `/planning` | projections · goals | — |
| `planning-life` | `/planning/life` | step-1 · step-2 | — |

## Beneficios

| screen_id | route | states | MVP |
|-----------|-------|--------|-----|
| `benefits` | `/(tabs)/benefits` | discounts · premium | — |
| `benefit-category` | `/benefits/[categoryId]` | list · empty | — |

## Configuración

| screen_id | route | states | MVP |
|-----------|-------|--------|-----|
| `settings` | `/settings` | — | ✅ |
| `settings-account` | `/settings/account` | default · delete-confirm | ✅ |
| `settings-banks` | `/settings/banks` | list · empty · disconnect-confirm | ✅ |
| `bank-review` | `/settings/banks/[bankId]` | ok · error | ✅ |
| `settings-notifications` | `/settings/notifications` | enabled · disabled | ✅ |
| `settings-categories` | `/settings/categories` | expense · income · edit · delete-confirm | ✅ |
| `settings-about` | `/settings/about` | — | ✅ |

## Design system

| screen_id | route |
|-----------|-------|
| `ds-colors` | `design-system/colors` |
| `ds-typography` | `design-system/typography` |
| `ds-components` | `design-system/components` |

---

## Diferencias respecto al prototipo v0

Cambios deliberados al reconstruir desde `personal-finances-app-mockups-v0`:

| Cambio | Motivo |
|--------|--------|
| `descuentos` → `benefits` · `cuenta` → `settings` · `presupuestos` → `budgets` | Los `screen_id` son slugs en inglés; el copy visible sigue en español (regla del framework) |
| `bank-syncing` es una pantalla nueva con 4 estados | El v0 no mostraba el progreso del scraper; es la interacción crítica del diferenciador |
| `bank-credentials` gana el estado `rut-locked` | La spec exige RUT único y no editable desde el segundo banco |
| `home` gana `empty` y `sync-error` | El v0 solo tenía el caso feliz |
| "Eliminar transacción" → "Excluir del análisis" | Nunca se borra un movimiento del banco; se excluye del cálculo. Alinea copy, modelo de datos y comportamiento |
| Se unificaron `transaction-categorization` y `ongoing-categorization` en `categorize` | Son la misma pantalla con distinto punto de entrada |
| Se descartó `onboarding` vs `welcome` duplicados | El v0 tenía dos pantallas de bienvenida solapadas |
| Se sacó el login con Google y Apple | El MVP parte solo con email + código. Menos superficie de auth y una dependencia nativa menos |
| Auth quedó **fuera del MVP** (`mvp: false`) | Sin servidor no hay contra qué autenticar: un código emitido y validado por el mismo cliente no valida nada, y la API key del servicio de correo viajaría extraíble dentro del binario. El perfil es el dispositivo. Las pantallas quedan dibujadas para cuando llegue el sync |
| `settings-account` → «Perfil local», sin cerrar sesión | No hay sesión que cerrar. «Eliminar cuenta» pasa a «Borrar todos mis datos», que es lo que realmente hace |
| Se agregaron `ds-*` | El framework los exige y no existían |

## Preguntas abiertas

1. **Formato de monto en tiles** — hoy `3.7M` en el resumen de Home y `$3.700.000` en Dashboard. ¿Se abrevia solo en tiles o en todas partes?
2. **Inclusión parcial** — el v0 permite incluir un % de una transacción. ¿Entra al MVP o se simplifica a incluir/excluir?
3. **`bank-syncing` en background** — ¿la sincronización puede correr con la app en segundo plano, o siempre requiere la pantalla abierta? Afecta el copy y el estado `home/empty`.
4. **Multi-banco en el MVP** — las pantallas soportan N bancos; el MVP implementa solo Banco de Chile. ¿Se muestra el selector con los demás en "Próximamente" (como está hoy) o se oculta?

## Decisiones cerradas

| Decisión | Resolución |
|----------|------------|
| Login social | Fuera. Ver diferencias arriba |
| Auth en el MVP | Fuera. El perfil es el dispositivo; `auth` y `verify-code` quedan `mvp: false` |
| Tab bar | Los mockups dibujan 4 tabs. **El MVP renderiza solo Inicio y Transacciones**; Presupuestos y Beneficios aparecen cuando esas secciones se implementen |
