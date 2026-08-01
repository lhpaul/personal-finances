# Bootstrap the Monorepo and the Expo App — Spec

## Overview

The repository today carries only the design system, the product documentation and the AI
development workflow. There is no application. This item creates the code skeleton that every
other backlog item builds on: a single workspace that holds the Expo app and the three shared
packages, one command surface for install, lint, type-check, test and run, a walkable route
skeleton that mirrors the mockup manifest, and automated checks on every pull request.

Nothing user-facing is built here. Every screen is a placeholder. The value delivered is that a
contributor — human or agent — can clone the repository, run one install command, boot the app
in a simulator, and walk the full MVP flow map before a single screen exists. The skeleton also
locks in the boundaries the product depends on, so that later work cannot quietly break them:
the domain rules stay pure, the app stays local-first, and the routing map stays tied to the
mockups.

---

## Use Cases

### Use Case 1: Set up the repository from a clean clone

**Actor**: Contributor (human developer or implementation agent) working on this product.
**Preconditions**: The contributor has a clean clone of the repository, the pinned Node version
and pnpm 11.12.0 or newer, and — for the simulator step — a macOS machine with Xcode installed.

**Steps**:

1. The contributor switches to the runtime version the repository pins.
2. The contributor runs the single install command from the repository root.
3. The contributor runs the lint, type-check and test commands from the repository root.
4. The contributor runs the mobile development command and opens the app in the iOS Simulator.

**Postconditions**: Dependencies for the app and all three shared packages are installed from
the committed lockfile, the three verification commands succeed, and the app boots to a
placeholder screen.

**Information shown**:

- Command output identifying which workspace each verification step ran against.
- The booted app showing a placeholder screen that names the mockup screen it stands for.

**Actions available**:

- Run any verification command for the whole workspace, or for one workspace at a time.
- Run the mobile development command targeting the iOS Simulator directly.

**Considerations**:

- The commands must succeed from a clean clone with no manual repair step, no undocumented
  environment variable and no hand-edited generated file.
- Verification must be performed under the pinned runtime version. If the contributor's
  installed runtime differs from the pinned one, the pinned version governs; see Business
  Rule 11.
- The simulator step requires Xcode and is the only step that cannot run on a non-macOS
  machine. Every other verification step must be runnable without a simulator.

---

### Use Case 2: Walk the MVP flow map before any screen exists

**Actor**: Contributor reviewing or planning screen work.
**Preconditions**: The app boots (Use Case 1).

**Steps**:

1. The contributor opens the app. On first launch it lands on the onboarding entry route; on a
   later launch it lands on the main-app home route instead. The gate that decides which one is
   entered reads `app_settings.onboarding_completed` and is wired by a separate item (see
   Business Rule 13); this item only creates both destinations as placeholders.
2. The contributor moves through the onboarding, categorization, main-app and settings areas.
   There is no sign-in area to move through — the product has none.
3. On any placeholder, the contributor reads which mockup screen that route will become.
4. The contributor opens the corresponding mockup entry to compare the intended flow.

**Postconditions**: Every MVP route in the mockup manifest has been reached and every reached
placeholder identifies the mockup screen it stands for.

**Information shown**:

- On each placeholder: the mockup screen identifier and the route it implements.
- Nothing else — no product data, no amounts, no sample bank movements.

**Actions available**:

- Navigate forward and back through the flow.
- Reach any MVP route directly rather than only by walking the flow, so a reviewer does not
  have to replay a whole wizard to inspect one route.

**Considerations**:

- Routes carrying an identifier in the path (a merchant, a transaction, a bank) must be
  reachable with any placeholder identifier value; the skeleton does not validate it.
- The out-of-MVP areas (Auth, Presupuestos, Planificación, Beneficios) are not reachable,
  because no route is created for them. See Business Rule 4.
- The tab area renders exactly two tabs, Inicio and Transacciones. The mockups draw four tabs;
  Presupuestos and Beneficios appear only when those sections ship (Deferral Note 2, resolved).

---

### Use Case 3: Get automated verification on a pull request

**Actor**: Contributor opening a pull request into the integration branch or the release branch.
**Preconditions**: The skeleton exists on the target branch.

**Steps**:

1. The contributor pushes a branch and opens a pull request into the integration branch or the
   release branch.
2. Automated checks run lint, type-check and test over the workspace.
3. The contributor reads the check results on the pull request.

**Postconditions**: The pull request shows a pass or fail result for each of lint, type-check
and test, and a failing result is attributable to a specific command.

**Information shown**:

- One result per verification check, with the failing command and its output when a check fails.

**Actions available**:

- Re-run the checks after pushing a fix.

**Considerations**:

- Checks install dependencies from the committed lockfile, so a lockfile that does not match
  the manifests fails rather than silently resolving to different versions.
- The web end-to-end regression checks stay disabled for this product; nothing in this item
  enables them (Business Rule 10).
- Device end-to-end coverage is not part of these checks and is tracked separately.

---

### Use Case 4: Be stopped from breaking the domain-purity boundary

**Actor**: Contributor (human or agent) writing code in the shared domain package.
**Preconditions**: The skeleton exists and the verification commands pass.

**Steps**:

1. The contributor adds, in the shared domain package, an import of app code, of an Expo
   module, or of a SQL library.
2. The contributor runs the lint command.

**Postconditions**: Lint fails and names the violated restriction; removing the import makes
lint pass again.

**Information shown**:

- A failure message that identifies the offending import and states that the shared domain
  package may not depend on the app, on Expo modules, or on any SQL library.

**Actions available**:

- Remove the import, or move the code to the workspace that is allowed to hold it.

**Considerations**:

- The restriction is enforced automatically, not by convention or code review. A reviewer must
  be able to demonstrate the failure on demand.
- The restriction applies to the shared domain package. The app and the other shared packages
  are not restricted by this rule.

---

## Business Rules

1. The workspace layout, workspace names and root command surface follow
   [`docs/project/2-repo-architecture.md`](../../../project/2-repo-architecture.md). If the
   skeleton needs to differ from that document, the document changes in the same change; the
   two never disagree.
2. There is exactly one shippable application (the mobile app) and three shared workspaces
   (domain rules, utilities, bank scraper). No additional application, no shared configuration
   workspace and no shared UI workspace is introduced.
3. The mockup manifest is the routing contract. A route exists in the app only if the manifest
   declares it, and it uses exactly the path the manifest declares. Adding, removing or
   renaming a route requires changing the manifest in the same change.
4. Route scope for this item is the MVP screens: every manifest screen that is not flagged as
   out of MVP, excluding the three design-system reference screens. The eight out-of-MVP
   screens (Auth, verificación de código, Presupuestos, crear presupuesto, Planificación,
   planificación de vida, Beneficios, categoría de beneficio) get no route. The design-system
   reference screens document the visual language and are not destinations in the app, so they
   get no route either.
5. Every route created in this item renders a placeholder. No route reads or writes product
   data, and no route reproduces mockup layout or copy as if it were implemented.
6. The shared domain package may not depend on the application, on Expo modules, or on any SQL
   library, and the repository rejects such a dependency automatically.
7. The skeleton preserves the product's non-negotiables by not making them impossible later:
   no placeholder collects, stores, displays or logs bank credentials; no monetary value is
   represented anywhere in the skeleton; no database schema, migration or seed is introduced;
   no scraping is performed.
8. The skeleton preserves the local-first promise: it introduces no first-party server
   endpoint, no network client to a first-party service, and no analytics or crash-reporting
   service. The only network access the product may make remains the ones already described in
   the software architecture document.
9. The AI development workflow that already lives in this repository keeps working unchanged.
   The markdown lint and formatting commands documented in `AGENTS.md` behave exactly as before
   after the root workspace manifest is replaced.
10. Web end-to-end regression stays disabled for this product. Device end-to-end coverage is a
    separate backlog item and is not wired up here.
11. The pinned runtime version is Node 22, matching the `zeki-platform` convention this
    repository follows (Expo SDK 54 / React Native 0.81 already run on Node 22 there; Node 20
    reached end-of-life in April 2026 and must not be pinned). If the app tooling cannot run on
    it, or the contributor's installed runtime is incompatible with the app tooling, that is
    escalated as an explicit decision — the pinned version is never changed silently to match
    whatever happens to be installed.
12. Verification is reproducible. The same commands succeed from a clean clone and in automated
    checks, resolving dependencies from the committed lockfile.
13. There is no sign-in in this product. The app's entry point is `(onboarding)/intro` on first
    launch and `(tabs)/home` on later launches; both routes are created as placeholders by this
    item. The gate that decides which one is entered — reading
    `app_settings.onboarding_completed` — is out of scope here and is wired by a separate item.
    The tab bar itself renders exactly two tabs, Inicio and Transacciones; Presupuestos and
    Beneficios are not tab destinations in this item because they have no route (Business Rule
    4).

---

## UX Rules

- Every placeholder screen states, in plain text on the screen, the mockup screen identifier
  and the route it stands for, so a reviewer can match it to the mockup without reading code.
- Placeholder screens look obviously unfinished. They do not imitate mockup layout, styling or
  copy, so a placeholder can never be mistaken for an implemented screen.
- No placeholder displays a monetary amount, a bank movement, an account, or any other product
  data — real or sample.
- The flow between placeholders follows the navigation structure declared in the mockup
  manifest, so the skeleton can be walked end to end in the order the product intends.
- Every MVP route is also reachable directly, not only by walking the flow that leads to it.
- The tab bar renders exactly two tabs — Inicio and Transacciones. Final tab labels, icons and
  styling arrive with the tab-shell implementation item; this item creates only the two
  tab-group route placeholders and their count.
- The skeleton introduces no visual design decisions: no colours, spacing or typography are
  chosen here, because the design tokens are mirrored into the app by a later item.

---

## Operational Visibility

- **Automated checks**: every pull request into the integration branch or the release branch
  reports a pass or fail result for lint, type-check and test. A failure identifies the command
  that failed.
- **Local visibility**: the same three verification commands are available from the repository
  root and per workspace, so a contributor sees the same result locally that the pull request
  will report.
- **No product telemetry**: this item introduces no analytics, crash reporting or remote
  logging. Adding any of those remains an explicit product decision.

---

## Acceptance Criteria

- [ ] **AC1.** From a clean clone, under the pinned runtime version and pnpm 11.12.0 or newer, the single
      root install command completes successfully with no manual repair step and no
      undocumented environment variable.
- [ ] **AC2.** From the repository root, the lint command, the type-check command and the test command
      each complete successfully, and each covers the mobile app and all three shared
      workspaces.
- [ ] **AC3.** Each of the three shared workspaces can also be built, developed, cleaned and linted on
      its own, and the mobile app can consume code from each of them.
- [ ] **AC4.** On a macOS machine with Xcode installed, the mobile development command boots the app in
      the iOS Simulator and the app renders a placeholder screen.
- [ ] **AC5.** Every MVP route listed in [MVP Route Scope](#mvp-route-scope) exists in the app, is
      reachable both by navigating the flow and directly, and renders a placeholder that names
      the mockup screen identifier and route it stands for.
- [ ] **AC6.** No route exists in the app for the eight out-of-MVP manifest screens (`auth`,
      `verify-code`, `budgets`, `budget-create`, `planning`, `planning-life`, `benefits`,
      `benefit-category`) or for the three design-system reference screens (`ds-colors`,
      `ds-typography`, `ds-components`).
- [ ] **AC7.** Adding, in the shared domain package, an import of app code, of an Expo module, or of a
      SQL library makes the lint command fail with a message naming the violated restriction;
      removing the import makes the lint command pass again.
- [ ] **AC8.** Opening a pull request into the integration branch or the release branch runs automated
      checks covering lint, type-check and test, and their individual results are visible on
      the pull request.
- [ ] **AC9.** The automated checks install dependencies from the committed lockfile, and a lockfile
      that does not match the workspace manifests makes the checks fail rather than resolving
      to different versions.
- [ ] **AC10.** The web end-to-end regression workflow is not part of the checks that run on these pull
      requests, and no browser-based end-to-end test is wired into them.
- [ ] **AC11.** The markdown lint and formatting commands documented in `AGENTS.md` produce the same
      results after this change as before it.
- [ ] **AC12.** No file introduced by this item contains a bank credential, a credential prompt, a
      monetary amount, a database schema or migration, or bank-specific scraping logic.
- [ ] **AC13.** The workspace names, directory layout and root command surface match
      [`docs/project/2-repo-architecture.md`](../../../project/2-repo-architecture.md); any
      intentional difference is reflected in that document within the same change.
- [ ] **AC14.** The tab bar renders exactly two tabs, Inicio and Transacciones, and no tab or
      route exists for Presupuestos or Beneficios. There is no sign-in route anywhere in the
      app: `(onboarding)/intro` and `(tabs)/home` both exist as placeholders, and no `(auth)`
      route group exists.

---

## MVP Route Scope

These are the manifest screens in scope for this item's route skeleton — every screen not
flagged out of MVP, excluding the three design-system reference screens.

| Area | Mockup screen | Route |
| --- | --- | --- |
| Onboarding | `onboarding-intro` | `/(onboarding)/intro` |
| Onboarding | `onboarding-value` | `/(onboarding)/value` |
| Onboarding | `connect-bank-intro` | `/(onboarding)/connect-bank` |
| Onboarding | `bank-picker` | `/(onboarding)/bank-picker` |
| Onboarding | `bank-credentials` | `/(onboarding)/bank-credentials` |
| Onboarding | `bank-syncing` | `/(onboarding)/bank-syncing` |
| Onboarding | `bank-connected` | `/(onboarding)/bank-connected` |
| Onboarding | `notifications-intro` | `/(onboarding)/notifications` |
| Onboarding | `notifications-schedule` | `/(onboarding)/notifications/schedule` |
| Onboarding | `onboarding-ready` | `/(onboarding)/ready` |
| Categorización | `stage-intro` | `/categorize/intro` |
| Categorización | `categorize` | `/categorize` |
| Categorización | `merchant-edit` | `/categorize/merchant/[merchantId]` |
| Categorización | `categorize-complete` | `/categorize/complete` |
| App | `home` | `/(tabs)/home` |
| App | `transactions` | `/(tabs)/transactions` |
| App | `transaction-detail` | `/transactions/[transactionId]` |
| App | `dashboard` | `/dashboard` |
| Configuración | `settings` | `/settings` |
| Configuración | `settings-account` | `/settings/account` |
| Configuración | `settings-banks` | `/settings/banks` |
| Configuración | `bank-review` | `/settings/banks/[bankId]` |
| Configuración | `settings-notifications` | `/settings/notifications` |
| Configuración | `settings-categories` | `/settings/categories` |
| Configuración | `settings-about` | `/settings/about` |

Explicitly **not** in scope for the route skeleton:

| Mockup screen | Route in the manifest | Why excluded |
| --- | --- | --- |
| `auth` | `/(auth)/sign-in` | Flagged out of MVP in the manifest — no sign-in in this product |
| `verify-code` | `/(auth)/verify-code` | Flagged out of MVP in the manifest — no sign-in in this product |
| `budgets` | `/(tabs)/budgets` | Flagged out of MVP in the manifest |
| `budget-create` | `/budgets/new` | Flagged out of MVP in the manifest |
| `planning` | `/planning` | Flagged out of MVP in the manifest |
| `planning-life` | `/planning/life` | Flagged out of MVP in the manifest |
| `benefits` | `/(tabs)/benefits` | Flagged out of MVP in the manifest |
| `benefit-category` | `/benefits/[categoryId]` | Flagged out of MVP in the manifest |
| `ds-colors` | — | Design-system reference, not an app destination |
| `ds-typography` | — | Design-system reference, not an app destination |
| `ds-components` | — | Design-system reference, not an app destination |

---

## Out of Scope (MVP)

- Screen implementations: layout, copy, styling, states and interactions for every route. Routes
  render placeholders only.
- The database: schema, migrations, seeds and data access of any kind.
- Scraper behaviour: bank-specific scripts, the scraping state machine and any real sync.
- Any sign-in or session concept: this product has none. Notification scheduling and any other
  product capability behind a route are also out of scope here.
- The theme file mirroring the design tokens, and the design-system primitives built on it.
- Routes for the eight out-of-MVP manifest screens and for the three design-system reference
  screens.
- The launch-time entry gate that reads `app_settings.onboarding_completed` to decide between
  `(onboarding)/intro` and `(tabs)/home`. This item creates both destinations as placeholders;
  the gate itself is wired by a separate item (Business Rule 13).
- The polished tab-bar shell — icons, labels and styling. This item creates exactly two
  tab-group route placeholders, Inicio and Transacciones (Deferral Note 2, resolved).
- Producing real store or internal builds. Build-profile definitions exist so later items have
  somewhere to add to; running builds and submissions is not part of this item.
- Device end-to-end flows.
- Enabling browser-based end-to-end regression, which stays disabled for this product.

---

## Brief Objective List

1. Root workspace configuration: workspace declaration covering the applications and packages
   directories, task orchestration, shared lint configuration, formatting configuration and
   ignore list, pinned Node version, package-manager configuration, and a root manifest that
   exposes development, build, test, lint, type-check, format and mobile-development commands.
2. The mobile app on Expo SDK 54 with file-based routing and strict TypeScript, including its
   app configuration, build-profile configuration, bundler configuration, test configuration,
   per-app lint configuration and per-app TypeScript configuration.
3. A route skeleton matching the mockup manifest, covering the onboarding, tab, categorization,
   transactions, dashboard and settings areas. There is no auth area — this product has no
   sign-in.
4. Three shared workspaces (domain rules, utilities, bank scraper), each with its own source
   directory, manifest exposing build, development, clean and lint commands, and TypeScript
   configuration.
5. An enforced restriction preventing the shared domain package from importing app code, Expo
   modules or any SQL library.
6. Automated checks running lint, type-check and test on pull requests into the integration
   branch and the release branch.
7. Brief-declared out of scope: screen implementations, database schema, scraper logic; routes
   render placeholders.
8. Brief acceptance criteria: install/lint/type-check/test pass from a clean clone; the mobile
   development command boots the app in the iOS Simulator; every MVP route in the manifest
   exists and is reachable, with no route for a screen flagged `mvp: false`; the tab bar renders
   exactly two tabs; the import restriction fails a deliberate violation; automated checks are
   green on the pull request.

---

## Coverage Matrix

| Brief objective | Coverage |
| --- | --- |
| 1. Root workspace configuration and command surface | AC1, AC2, AC13; Business Rules 1, 2, 9, 11, 12 |
| 2. The mobile app with file-based routing and strict TypeScript | AC2, AC4, AC13; Business Rule 1 |
| 3. Route skeleton matching the manifest | AC5, AC6, AC14; Business Rules 3, 4, 5, 13; MVP Route Scope; UX Rules |
| 4. Three shared workspaces with their own commands | AC2, AC3; Business Rules 1, 2 |
| 5. Enforced domain-purity import restriction | AC7; Business Rule 6; Use Case 4 |
| 6. Automated checks on pull requests | AC8, AC9, AC10; Business Rules 10, 12; Operational Visibility |
| 7. Brief-declared out of scope (screens, database, scraper; placeholders only) | Out of Scope; AC12; Business Rules 5, 7 |
| 8a. Install, lint, type-check and test pass from a clean clone | AC1, AC2, AC3 |
| 8b. The mobile development command boots the app in the iOS Simulator | AC4 |
| 8c. Every MVP route in the manifest exists and is reachable; no route for an `mvp: false` screen | AC5, AC6 (scoped to MVP routes — Deferral Note 1, resolved) |
| 8d. The import restriction fails a deliberate violation | AC7 |
| 8e. Automated checks are green on the pull request | AC8, AC9, AC10 |
| 8f. The tab bar renders exactly two tabs | AC14 (Deferral Note 2, resolved) |

---

## Deferral Notes

### Deferral Note 1 — "Every route in the manifest exists and is reachable" (RESOLVED)

**Objective wording**: "Every MVP route in the manifest exists and no route exists for a screen
flagged `mvp: false`" (issue #1, rewritten 2026-08-01).

**Rationale**: Read literally against an earlier version of the brief, the manifest's "every
route" wording was ambiguous about the eight screens flagged out of MVP (Auth, verificación de
código, Presupuestos, crear presupuesto, Planificación, planificación de vida, Beneficios,
categoría de beneficio) and the three design-system reference screens that are not app
destinations at all. Creating routes for screens that are out of implementation scope would
produce dead destinations that later work would have to remove, and would force a tab bar
containing destinations the MVP does not ship.

**Resolution**: The product owner rewrote issue #1 to state the MVP-only scoping explicitly,
including moving Auth from an MVP route to an `mvp: false` screen. This spec's criterion is
narrowed to the 25 MVP routes listed under [MVP Route Scope](#mvp-route-scope); the exclusion is
stated explicitly rather than dropped silently. **Source**: issue #1 rewrite, 2026-08-01, human
instruction to the runner ("AUTH IS OUT OF THE MVP ENTIRELY").

### Deferral Note 2 — MVP tab-bar composition (RESOLVED)

**Objective wording**: Derived from brief objective 3 (a route skeleton covering the tab area)
combined with the mockups, which draw a four-tab bar (Inicio, Transacciones, Presupuestos,
Beneficios) on every tab screen.

**Rationale**: Two of the four drawn tabs lead to out-of-MVP destinations. Because this item
creates no route for those destinations, the skeleton's tab area can expose at most the MVP
tabs. Whether the *released* MVP ships a two-tab bar or keeps four tabs with the out-of-MVP ones
visibly unavailable was a product decision about the shipped experience, not about the skeleton.

**Resolution**: The tab bar renders exactly two tabs, Inicio and Transacciones; Presupuestos and
Beneficios are not rendered, even as disabled placeholders, and appear only when those sections
ship. See Business Rule 13, Use Case 2, UX Rules, and AC14. **Source**: issue #1 rewrite,
2026-08-01, human instruction to the runner ("Tab bar renders exactly two tabs: Inicio and
Transacciones").
