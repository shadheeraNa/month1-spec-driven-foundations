<!--
Sync Impact Report
==================
Version change: (unversioned template) → 1.0.0
Bump rationale: Initial ratification. All template placeholders replaced with
concrete project governance derived from prd.md.

Modified principles:
- [PRINCIPLE_1_NAME] → I. Type Safety Is Non-Negotiable
- [PRINCIPLE_2_NAME] → II. Validate At The Boundary
- [PRINCIPLE_3_NAME] → III. Scope Discipline (YAGNI)
- [PRINCIPLE_4_NAME] → IV. Diagnosable By Default
- [PRINCIPLE_5_NAME] → V. Green Pipeline Or Not Done

Added sections:
- Technology & Performance Constraints (was [SECTION_2_NAME])
- Development Workflow & Quality Gates (was [SECTION_3_NAME])
- Governance (rules populated)

Removed sections: none

Deferred TODOs: none
-->

# Ticket Triage Dashboard Constitution

## Core Principles

### I. Type Safety Is Non-Negotiable

The codebase MUST be TypeScript in strict mode and MUST contain zero `any` types.
`tsc --noEmit` MUST exit with 0 errors. All database access MUST go through the
Prisma typed client; hand-written SQL and untyped fetch results are prohibited.
The `Ticket` shape MUST be defined once (prisma/schema.prisma) and derived
everywhere else — UI and API MUST NOT declare parallel ticket types.

*Rationale:* UI and API share one codebase (ADR-001), so a drifting ticket shape
becomes a runtime bug in both halves at once. Types are the cheapest gate that
catches it.

### II. Validate At The Boundary

100% of API write payloads MUST be schema-validated with Zod at the request
boundary, before any state change. A payload that fails validation MUST be
rejected with HTTP 400 and MUST leave stored data unchanged. Priority MUST be
one of `P0`, `P1`, `P2` — no other value may reach the data layer. Validation
MUST NOT be duplicated inside handlers or the persistence layer; the boundary
schema is the single authority.

*Rationale:* There is no authentication (NG-1), so the request boundary is the
only trust boundary this system has. Partial writes from invalid input are the
failure mode that corrupts the triage view.

### III. Scope Discipline (YAGNI)

The Non-Goals in prd.md are binding constraints, not suggestions. This project
MUST NOT add authentication or roles, Teams/email/spreadsheet ingestion, ticket
creation or deletion via the UI, notifications or escalation alerts, or analytics
beyond per-priority count badges. Tickets are loaded from a JSON seed file only.
Any feature outside the stated Goals (G-1..G-5) MUST be rejected in review unless
this constitution is amended first.

*Rationale:* This is a scaffold sized to one trusted internal user. Every
speculative feature adds surface that the CI budget (NFR-3) and the 1.5s render
target (NFR-1) must then carry.

### IV. Diagnosable By Default

Every API request MUST emit exactly one structured log line containing method,
path, HTTP status, and response time in milliseconds — 100% of requests, no
exceptions. Requests returning 4xx or 5xx MUST additionally include the error
reason (the Zod validation message or the exception type). A failure MUST be
diagnosable from logs alone, without reproducing it locally.

*Rationale:* The dashboard's value is trust in the P0 count. When a write is
silently rejected, logs are the only way to find out why.

### V. Green Pipeline Or Not Done

A change is complete only when the GitHub Actions pipeline passes on its pull
request: lint, type check, smoke test, and build MUST each exit 0. A red or
skipped check MUST NOT be merged or reported as done. All commits MUST be signed
and MUST follow Conventional Commits format; CI allows 0 non-compliant commits.
Database changes MUST ship as a Prisma migration that runs clean in CI.

*Rationale:* With no staging environment and no manual QA step, CI is the only
place correctness is verified before merge.

## Technology & Performance Constraints

The stack is fixed by the accepted ADRs and MUST NOT be substituted without an
amendment plus a superseding ADR:

- **Framework:** Next.js 15 (App Router), TypeScript strict. UI under `src/app/`;
  the JSON API runs from colocated server routes. One build, one CI pipeline.
- **Data layer:** Prisma over SQLite. The `Ticket` entity is defined in
  `prisma/schema.prisma` and seeded from the JSON file. All reads and writes go
  through Prisma so a later Postgres swap stays a config change, not a rewrite.
- **API surface:** `GET /tickets` returns 200 with a JSON array. `PATCH
  /tickets/:id` returns 200 with the updated ticket on valid input, 400 on
  invalid input.

Performance budgets are acceptance criteria, not aspirations:

- Initial dashboard render < 1.5s on localhost with the seed data set (NFR-1).
- API read and update p95 < 150ms against the seed data (NFR-2).
- Full CI pipeline (lint, type check, test, build) < 3 minutes end-to-end (NFR-3).

A change that regresses any budget MUST be fixed or reverted before merge.

## Development Workflow & Quality Gates

1. Work starts from a written requirement traceable to a Goal (G-1..G-5) or a
   Functional Requirement (FR-1..FR-5) in prd.md. Untraceable work is out of
   scope under Principle III.
2. Every change lands via pull request against `main`. Direct pushes to `main`
   are prohibited.
3. The pull request MUST pass lint, type check, smoke test, and build before
   review is considered complete (Principle V).
4. Acceptance criteria are the Given/When/Then cases in prd.md §4. A functional
   requirement is met only when its stated cases hold, including the rejection
   cases (invalid priority, closed tickets hidden, zero-count groups shown as 0).
5. Reviewers MUST verify: no `any` types introduced, write paths validated by
   Zod, no Non-Goal feature added, request logging intact, performance budgets
   unaffected.
6. Architecture decisions that change the stack MUST be recorded as a new ADR in
   prd.md §6 with Status, Context, Decision, Consequences, and Alternatives.

## Governance

This constitution supersedes other practices and conventions for this project.
Where a habit, tool default, or generated scaffold conflicts with a principle
here, the principle wins.

**Amendment procedure:** Amendments MUST be proposed as a pull request that edits
this file, states the rationale, and lists any code, ADR, or CI changes required
to comply. An amendment is adopted when the pull request is approved and merged;
the version and Last Amended date MUST be updated in the same pull request.

**Versioning policy:** This document follows semantic versioning.
MAJOR — a principle is removed or redefined in a backward-incompatible way.
MINOR — a principle or section is added, or guidance is materially expanded.
PATCH — clarification, wording, or typo fixes with no change in meaning.

**Compliance review:** Every pull request review MUST verify compliance with the
Core Principles; the checks in Development Workflow item 5 are the minimum.
Complexity that violates Principle III MUST be justified in writing in the pull
request or removed. Violations discovered after merge MUST be filed and fixed
before the next feature lands in the same area.

**Version**: 1.0.0 | **Ratified**: 2026-09-05 | **Last Amended**: 2026-09-05
