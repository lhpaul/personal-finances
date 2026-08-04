# Testing Best Practices

## Testing Strategy

The testing strategy for this project — tools, tiers, when each runs, and how they relate — belongs in:

> `docs/project/3-software-architecture.md` → **Testing Strategy** section

Define it there during project setup. This file covers principles and conventions that apply regardless of which tier or tool you are working with.

## General Principles

- **Test behavior, not implementation** — tests should break when the behavior changes, not when the code is refactored
- **Readable tests are as important as readable code** — a test is documentation
- **One assertion per test** when possible — makes failures easier to diagnose
- **Tests must be deterministic** — a test that sometimes passes and sometimes fails is worse than no test
- **Don't delete tests to make the build pass** — fix the root cause

## What to Test

### Always test:

- Business logic and domain rules
- Edge cases (empty lists, null values, boundary conditions)
- Error handling paths (what happens when a dependency fails)

### Test selectively:

- Integration with external services (use mocks/stubs at the boundary)
- UI components (test interaction, not styling)

### Don't over-test:

- Simple getters/setters with no logic
- Framework code or third-party library internals
- Implementation details that may change during refactoring

## Smoke Tests

Smoke tests validate key user journeys in a running environment. They are defined in runbooks:

```
docs/testing/[app-or-section]/[feature-slug].smoke-test.md
```

See the [smoke test runbook template](../workflow/development-workflow/templates/smoke-test-runbook-template.md) for the standard format, and [docs/testing/README.md](../testing/README.md) for how to execute them in this repo.

Smoke tests should be run:

- Before every release
- After deploying to staging
- When investigating a reported production issue

The recommended approach is a **two-tier execution model**: a committed automated test suite (preferred) with ad-hoc scripts as a fallback when no spec exists yet. See `docs/project/3-software-architecture.md` → Testing Strategy.

## Filter-Schema Canary Tests

Any PR that adds a new filter parameter to a tool schema (Zod, JSON Schema, Joi, Pydantic, OpenAPI, or any equivalent contract-declaration mechanism) **must include a canary test** for each added filter before it may be merged.

**What a canary test must do**:

1. Call the tool with the new filter set to a value that narrows or alters the result set.
2. Call the tool again with the filter absent or set to a meaningfully different value.
3. Assert that the two result sets differ.

**Why**: A filter added to a schema is accepted by the API but may not be wired to the query builder's WHERE clause. Without a canary test, this silent no-op reaches production undetected.

**Exemption**: Modifying or removing an existing filter parameter without changing the schema contract does not trigger the canary obligation, though confirming existing tests still pass is encouraged.

**Framework-agnostic**: The requirement is satisfied regardless of language or test framework. The substance — two invocations, differing results — is what matters.

## Device E2E

Device E2E flows live in `.maestro/` and are driven by `.maestro/flow-contract.json` — see
[`.maestro/README.md`](../../.maestro/README.md) for the full contract and how to run the suite.
Three rules apply to every flow, regardless of which item adds it:

- **Selector rule**: a `tapOn`/`assertVisible`/`below`/`above` literal must be either an exact
  `apps/mobile/src/i18n/es.json` value or a declared `data_selectors` entry (for data-derived
  text — a seeded name, a fixture merchant — never app copy). `pnpm e2e:lint` fails the moment a
  selector drifts from the catalogue, before any device run.
- **Fixture-state extension obligation**: a flow that needs a new device state adds a row to
  `E2E_FIXTURE_STATES` (`apps/mobile/src/dev/e2e-fixture-store.ts`) **and** declares it in
  `flow-contract.json`'s `fixture_states`. `pnpm e2e:contract` fails if a flow references an
  undeclared state, or if a declared state has no flow using it.
- **Never a real credential**: `pnpm e2e:lint` proves this mechanically over every file under
  `.maestro/` — no inline suppression directive exists, by design. The only exceptions are the two
  declared `credential_fixtures` constants (a fixture RUT and password) and the `input_values`
  allowlist, all declared once in `flow-contract.json`.

## Test Data and Seed Data

- Tests that require data should use deterministic seed data, not random values
- Seed data should cover all scenarios, roles, and statuses (see `docs/project/4-database-model.md`)
- Never use production data in tests

## Running Tests

```bash
# Run all tests
[command]

# Run a specific test file
[command path/to/test]

# Run tests in watch mode
[command --watch]
```

## CI Integration

All tests run automatically on every pull request. A PR cannot be merged if:

- Any test fails
- Test coverage drops below the configured threshold (if applicable)
