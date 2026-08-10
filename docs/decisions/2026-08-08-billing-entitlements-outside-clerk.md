# Keep Billing and Entitlements Outside Clerk

- Status: Accepted
- Date: 2026-08-08
- Owner: Product and Architecture

## Context

The future remote MCP capability will need a commercial boundary: subscription status, analysis
quotas, entitlement changes, and revocation. Clerk can offer a billing product, but it adds a
percentage fee to billing volume and couples payments and product entitlements to the identity
provider.

The MVP has no billing or backend. This decision defines the ownership boundary for the future
remote phase only.

## Decision

Use Clerk for identity and OAuth MCP authorization, but do not use Clerk Billing. The selected
payment provider and the product backend own billing events, subscription state, usage quotas, and
entitlements. The backend is the sole authority that decides whether an authenticated user may
invoke an MCP tool.

## Alternatives Considered

- **Clerk Billing** — rejected to avoid the additional billing-volume fee and payment-provider
  coupling.
- **Embed plan access only in Clerk token claims** — rejected because asynchronous billing changes,
  quota consumption, revocation, and auditability require an application-owned source of truth.
- **No entitlement layer** — rejected because remote analysis has variable operating cost and needs
  abuse and spend controls.

## Consequences

- OAuth identity, payment processing, and authorization are intentionally separate concerns.
- The backend maintains an entitlement ledger keyed by the product's internal user identifier.
- MCP tools check tool scope and entitlement at execution time, rather than trusting client UI or
  a stale token claim.
- Changing payment providers does not require an OAuth or account migration.

## Revisit Triggers

- The selected payment provider cannot support the required channels or markets.
- Entitlement checks create unacceptable latency or availability coupling for MCP tool calls.
- A future consolidated billing offering is demonstrably cheaper while preserving exportability and
  server-side authorization controls.
