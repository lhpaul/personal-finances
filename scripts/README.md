# Repository scripts

Scripts intended to be run from the repository root or from CI/CD.

## Development workflow

AI development workflow helpers (orchestrator, Codex skills, PR/CI loops) live in **`scripts/development-workflow/`**. See [development-workflow/README.md](development-workflow/README.md) for usage.

## Design mockups

Mockup manifest verification (navigation targets, unique local states, DOM/manifest parity,
`data-states` / `go()` targets, semantic colour tokens mirrored in `:root`) lives in
**`scripts/design/`** — run with `pnpm mockups:verify` / `pnpm mockups:verify:test`. See
[`design/mockups/README.md`](../design/mockups/README.md).

## Design fidelity

The mockup-vs-app pixel fidelity gate (contract validator, mockup/simulator capture, comparator, `pnpm fidelity*` scripts) is the separate fidelity kit and lives in **`scripts/mobile-ui/`**. See [`docs/best-practices/stack/mobile-ui-fidelity.md`](../docs/best-practices/stack/mobile-ui-fidelity.md).

Repositories created from this template can add their own scripts alongside this directory (e.g. `scripts/build.sh`, `scripts/deploy.sh`) without mixing them with the template’s workflow scripts.
