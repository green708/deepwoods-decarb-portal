# ADR-001: Multi-Client Platform Architecture

**Status:** Accepted  
**Date:** 2026-07  
**Decision makers:** Deepwoods team

---

## Context

The portal was originally built for Featherlite (a single client). As the consultancy scales to multiple clients, the platform must support any organisation without code changes.

## Decision

Build a multi-tenant architecture where:
1. Every data table includes a `client_id` foreign key
2. A `clients` master table stores all client organisations
3. Auth sessions are scoped to `client_id` — users can only see their own client's data
4. Client configuration (branding, entities, enabled pages, targets) is stored in `client_config` as key-value pairs
5. Entity structure is configurable per client via `client_entities`

## Consequences

**Positive:**
- A single database holds all client data safely isolated
- New clients can be onboarded without deploying new code (just DB rows)
- Client configuration is dynamic and doesn't require frontend changes

**Negative:**
- All SQL queries must include `client_id` in WHERE clauses — easy to forget
- Consolidated entity aggregation must be done in the API layer, not just the frontend
- Schema changes affect all clients simultaneously

## Alternatives Considered

**Separate databases per client:** Rejected — too complex to maintain at scale, problematic for shared infrastructure.

**Subdomain-per-client with separate deployments:** Rejected — requires separate deployments for each client; not scalable for a small consultancy team.
