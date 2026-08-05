# Maestro E2E flows

Contract-driven device E2E suite for Finanzas (issue #22). `flow-contract.json` is the single
source of truth for the fixture states, the flow list, the credential fixtures and the two
selector allowlists; two Node validators prove the contract and the flow files agree.

## Running the suite

```bash
# No simulator required — the CI test job runs these on every PR:
pnpm e2e:contract   # validates flow-contract.json against the mockup manifest
pnpm e2e:lint       # AC2's credential scanner + the selector rule (D10)
pnpm e2e:test       # node --test over both validators' own unit tests

# Requires a booted "Finanzas E2E" simulator with a Debug (__DEV__) build installed and Metro
# running (see docs/testing/mobile/22-maestro-e2e-flows.smoke-test.md for the full prerequisite
# list):
pnpm e2e                                            # the whole suite (AC1's command, wrapped)
maestro test .maestro/                              # AC1's literal acceptance command
bash scripts/e2e/run-e2e.sh .maestro/flows/01-onboarding-connect.yaml   # a single flow
```

## Layout

- `flow-contract.json` — fixture states, credential fixtures, forbidden hosts, the
  `input_values` / `data_selectors` allowlists, and the flow list (id, file, fixture state,
  covered screens, status, owning issue).
- `config.yaml` — `flows:` enumerates exactly the wired flow files, so `maestro test .maestro/`
  runs this suite and nothing else (it does not also try to execute `shared/*.yaml`).
- `flows/*.yaml` — one file per wired flow.
- `shared/reset.yaml`, `shared/fixture.yaml` — subflows every flow's fixture-state application
  goes through; never listed in `config.yaml`'s `flows:` themselves.

## The fixture contract (D6)

`/(dev)/e2e-fixtures` (`finanzas:///e2e-fixtures`) exposes five named, idempotent device states —
`reset`, `synced-home`, `stage-queue`, `transaction-detail`, `scripted-read` — built from the
existing `__DEV__` fixture surfaces plus a new `apps/mobile/src/db/dev-e2e-fixture.ts` /
`apps/mobile/src/dev/e2e-fixture-store.ts` pair. `shared/fixture.yaml` is the one place a flow
applies a state: it opens the panel, taps the state's action label, and asserts the panel's own
per-state success line before returning.

**Extension obligation**: a future feature that needs a new device state adds a row to
`E2E_FIXTURE_STATES` (`apps/mobile/src/dev/e2e-fixture-store.ts`) **and** declares it in
`flow-contract.json`'s `fixture_states`. A flow may not reference a state that is not declared,
and a declared state that no flow uses is a validation error (`pnpm e2e:contract` catches both).

## The selector rule (D10)

13 screens carry a root `fidelityTestId(...)` anchor; `home`, the onboarding screens and every
settings screen carry none — this suite selects by the accessibility label / visible text
`apps/mobile/src/i18n/es.json` already supplies, the same string the mockup declares. Every
`tapOn`/`assertVisible`/`below`/`above` literal must be either an exact `es.json` value or a
declared `data_selectors` entry (for data-derived text: a seeded institution or category name, a
fixture merchant name — never app copy). `pnpm e2e:lint` fails the moment a selector no longer
matches, before any device run. Copy containing `{{count}}`-style interpolation is never a legal
selector.

Two ambiguous-copy hazards this suite is explicit about: `onboarding_intro.cta` and
`onboarding_ready.cta` are both "Comenzar"; `categorize.exclude_title` and
`transaction_detail.action_exclude` are both "Excluir del análisis". Every flow asserts a
screen-unique anchor before tapping either.

## Never a real credential (AC2, D13)

`pnpm e2e:lint` implements four rules with **no suppression directive** — the only exceptions are
the two declared `credential_fixtures` constants (RUT `12.345.678-5`, password `ZZE2EPASSZZ`) and
the `input_values` allowlist, all declared once in `flow-contract.json`:

- **R1 — RUT shape**: any RUT-shaped literal, anywhere (including comments), other than the
  declared fixture RUT.
- **R2 — credential-shaped YAML key**: `password` / `clave` / `contraseña` / `contrasena` /
  `secret` / `token` / `apiKey` with a literal scalar value, other than the declared fixture
  password or a `${…}` reference.
- **R3 — typed input allowlist**: every `inputText:` literal must be declared — this is the rule
  that actually closes the credential path, since typing is how a secret would enter a flow.
- **R4 — real-bank host**: a hostname under any of the two real Banco de Chile domains named in
  `flow-contract.json`'s `forbidden_hosts` array (not spelled out here, so this very paragraph
  does not itself trip the scanner's own blanket substring match).

`flow-contract.json` itself is exempt from R1-R4 (never from the selector rule) — it is the
declaration surface for the constants and the forbidden-host list; scanning it would otherwise
self-flag its own `forbidden_hosts` entries as if they were visited hosts.

## Promoting a `planned` flow

Every flow in this suite is `wired` as of this item's dispatch (screens #18/#19/#20/#21 were all
merged on `develop` by the time this item was implemented, so the four flows the plan originally
declared as extensions — `07-settings-wipe`, `08-settings-banks`, `09-settings-categories`,
`10-notifications` — were promoted immediately rather than left `planned`). If a future MVP screen
ships without a flow yet, promotion is the same three-line change:

1. Write `flows/<n>-<slug>.yaml`.
2. Flip its `flow-contract.json` row's `"status"` to `"wired"`.
3. Add the file to `config.yaml`'s `flows:` list.

`07-settings-wipe.yaml` wipes the local store — any newly-added flow must run **before** it in
`config.yaml`, never after.

## CI

`ci.yml`'s `test` job runs `pnpm e2e:contract`, `pnpm e2e:lint` and `pnpm e2e:test` on every PR —
no simulator, no cost. The device leg (`maestro-ios` in `e2e-regression.yml`) is wired but inert
until the repository variable `ENABLE_MAESTRO_E2E` is set to `true` — see the implementation
plan's *Owner decision required* section.
