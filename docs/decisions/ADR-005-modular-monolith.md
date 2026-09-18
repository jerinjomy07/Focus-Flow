# ADR-005: Modular Monolith over Microservices

**Date:** 2026-09-17  
**Status:** Accepted  
**Author:** Architecture Team

---

## Context

FocusFlow is a new product with a small initial team. The architecture decision of monolith vs. microservices is foundational and expensive to reverse.

## Decision

Build FocusFlow as a **modular monolith** — a single deployable application with internal domain boundaries.

## Rationale

### Why not microservices at this stage

Microservices introduce significant operational complexity:
- Service discovery
- Inter-service network latency
- Distributed tracing
- Independent deployment pipelines per service
- Distributed transaction management (critical for session data integrity)
- More complex local development environment
- Higher infrastructure cost

These costs are worthwhile when:
- Teams need independent deployment cadences
- Different services have radically different scaling needs
- Services benefit from different technology stacks

FocusFlow has no demonstrated need for any of these. A small product with a small team will move faster with a monolith.

### Why modular monolith (not a big ball of mud)

The word "monolith" does not mean disorganized. FocusFlow's monolith has:
- Explicit domain boundaries (`domain/timer`, `domain/analytics`, `domain/streaks`)
- Clear dependency rules (domain layer has no I/O dependencies)
- No circular dependencies between domains
- Pure domain functions, testable in isolation

This internal structure means that if a service extraction is ever required, it is a deployment decision, not a rewrite.

### When to reconsider

Microservices should be reconsidered if:
- A specific domain (e.g., analytics) has query load significantly disproportionate to others
- A background notification service needs to run independently of the web application
- Team size grows to the point where independent deployment cadences are required

## Trade-offs Accepted

- Scaling is per-application, not per-domain (but Vercel handles this well with serverless functions)
- All code is in one repository (monorepo could be added later if needed)

## Consequences

- Single Next.js application containing all domains
- Single PostgreSQL database
- Single Vercel deployment
- Domain logic is internally separated by folder conventions and dependency rules
- Future service extraction is possible but not required
