# Architecture Decisions

This directory is the durable record of material architecture and product-boundary decisions.
The current architecture is described concisely in
[Software Architecture](../project/3-software-architecture.md); these records preserve why a
decision was made, which alternatives were considered, and when it should be revisited.

## Lifecycle

- **Proposed** — under consideration and not yet a repository commitment.
- **Accepted** — the decision to follow until it is superseded.
- **Superseded** — retained for history and linked to the newer record that replaces it.
- **Deprecated** — no longer applicable, without a direct replacement.

An accepted record is not silently rewritten when its conclusion changes. Create a new record,
mark the old one as superseded, and link the two records.

## Naming

Use `YYYY-MM-DD-kebab-case-title.md`. Keep the date of the decision, even when the record is
written shortly afterwards.

## Required sections

Every record includes:

1. Status and date.
2. Context.
3. Decision.
4. Alternatives considered.
5. Consequences.
6. Revisit triggers.

## Records

| Date | Status | Decision |
| --- | --- | --- |
| 2026-08-08 | Accepted | [Use Clerk as the OAuth authorization server for remote MCP](2026-08-08-mcp-oauth-authorization-with-clerk.md) |
| 2026-08-08 | Accepted | [Keep billing and entitlements outside Clerk](2026-08-08-billing-entitlements-outside-clerk.md) |
