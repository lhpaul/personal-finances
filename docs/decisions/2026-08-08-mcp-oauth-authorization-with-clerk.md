# Use Clerk as the OAuth Authorization Server for Remote MCP

- Status: Accepted
- Date: 2026-08-08
- Owner: Product and Architecture

## Context

The MVP is local-first: it has no backend, account, remote storage, or MCP server. A future
remote phase may let people connect their financial analysis to MCP clients such as Claude and
ChatGPT. That integration requires an interoperable OAuth authorization flow, including consent,
PKCE, token refresh, discovery metadata, client registration compatibility, scopes, and revocation.

Firebase Authentication is suitable for an app and backend identity flow, but it did not provide
the complete MCP OAuth authorization-server experience needed to connect external MCP clients.
Implementing that protocol from scratch was rejected as a high-risk security responsibility.

## Decision

When the remote MCP phase is explicitly approved, use Clerk as the OAuth authorization server for
the remote MCP server. Clerk owns user authentication for that phase, OAuth consent, and the
authorization tokens used by MCP clients. The MCP server remains the resource server: it validates
the token, its intended audience, and tool scope before accessing any data.

The decision does not authorize implementation of Clerk, a backend, remote synchronization, or
an MCP server in the MVP.

## Alternatives Considered

- **Firebase Authentication alone** — retained as a possible app-auth option, but rejected for
  the MCP authorization-server responsibility because it did not solve the required client
  interoperability flow.
- **Firebase Authentication plus MCP Billing** — potentially lower-cost and more self-controlled,
  but requires evaluating a recent commercial boilerplate and operating its OAuth integration.
- **Auth0** — a mature MCP/OAuth candidate, but not selected because Clerk provides a more direct
  developer path for this product's expected MCP integration.
- **Keycloak, Ory, or another self-hosted provider** — preserves maximum control and avoids MAU
  pricing, but transfers availability, upgrades, incident response, and OAuth security operations
  to the product team.
- **Implement OAuth directly** — rejected because authorization-server correctness is a security
  boundary, not an application feature to maintain casually.

## Consequences

- Future remote architecture is optimized for early interoperability with MCP hosts rather than
  the lowest possible identity cost at very large scale.
- Clerk's MAU-based cost must be monitored before the remote product reaches its paid threshold.
- The product keeps a provider-neutral internal user identifier and authorization boundary so a
  future migration remains possible.
- Financial authorization remains server-side and tool-specific; authenticating a person does not
  grant unrestricted access to their financial history.

## Revisit Triggers

- Clerk lacks compatibility with a required MCP host or MCP authorization-spec revision.
- Projected identity cost becomes materially disproportionate to remote-product revenue.
- A regulatory, data-residency, or customer requirement requires self-hosted identity.
- A security review finds that Clerk cannot express the necessary consent, revocation, scope, or
  audit requirements.
