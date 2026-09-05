# Ticket Triage Tool — PRD

## 1. Persona

**Primary user:** Oneth, Associate Project Manager at BISTEC Global.

**Context:** Oneth works in the Project Management Office and is the first point
of contact for internal requests raised against active client delivery teams
(access requests, environment issues, scope questions, blocked tasks). On a
normal week he handles 40 to 60 of these tickets across 8 to 10 project teams.
Today they arrive through a mix of Microsoft Teams messages, email, and a shared
spreadsheet, with no single prioritized view. Each morning he manually re-reads
the spreadsheet, guesses what is urgent, and pings owners to confirm status.

**Pain point:** There is no at-a-glance view of what is open and how urgent it
is. Oneth cannot quickly answer "how many P0s are open right now and who owns
them," so genuinely urgent tickets sit unseen next to routine ones. He spends
roughly 30 minutes every morning reconciling sources by hand, and P0 items are
occasionally missed until someone escalates.

## 2. Problem Statement

**What breaks today:** Internal PMO tickets are spread across Microsoft Teams,
email, and a shared spreadsheet with no single prioritized view. There is no
reliable way to see how many tickets are open, what priority they are, or who
owns them without manually reconciling three sources.

**Who is affected:** The PMO coordinator (Oneth) directly, plus the 8 to 10
delivery teams whose blockers wait in the queue. Roughly 40 to 60 tickets per
week pass through this manual process.

**Impact (measured):** Reconciling sources by hand costs about 30 minutes every
morning (roughly 2.5 hours per week). Because urgency is judged by eye, P0
tickets are sometimes missed until escalation, adding hours of delay to the
issues that matter most.

**Why now:** Ticket volume has grown with the number of active teams, and the
spreadsheet approach does not scale. A single lightweight dashboard that lists,
prioritizes, and groups tickets removes the daily manual reconciliation and
makes urgent items visible immediately.

## 3. Goals & Non-Goals

### Goals (measurable)

- G-1: A PMO user can see all open tickets in one view without opening any other
  tool, replacing the current 3-source manual reconciliation.
- G-2: The dashboard groups open tickets by priority (P0/P1/P2) and shows a count
  badge per group, so the number of open P0s is visible without counting by hand.
- G-3: A user can assign or change a ticket's priority and owner and see the
  change reflected in the grouped view.
- G-4: Initial dashboard render completes in under 1.5s on localhost with the
  seed data set.
- G-5: API read and update endpoints respond with a p95 under 150ms against the
  seed data.

### Non-Goals (explicit exclusions)

- NG-1: No user authentication or role-based access. The tool assumes a single
  trusted internal user for this scaffold.
- NG-2: No automatic ingestion from Microsoft Teams, email, or the existing
  spreadsheet. Tickets are loaded from a JSON seed file only.
- NG-3: No ticket creation or deletion through the UI. The scope is list, tag,
  and group existing seeded tickets.
- NG-4: No notifications, reminders, or escalation alerts.
- NG-5: No reporting or analytics beyond the per-priority count badges.

## 4. Functional Requirements

### FR-1: List open tickets from seed data
The PMO user can view all open tickets loaded from a JSON seed file.

- Given the JSON seed file has loaded
  When the user opens the dashboard
  Then every ticket with status "open" is displayed, each showing its title,
  priority, and owner.
- Given a ticket has status "closed" in the seed file
  When the dashboard renders
  Then that ticket is not shown in the open list.

### FR-2: Tag ticket priority and owner
The user can set a ticket's priority (P0/P1/P2) and assign an owner.

- Given an open ticket is displayed
  When the user sets its priority to P0, P1, or P2 and assigns an owner
  Then the ticket's priority and owner are updated and the change persists.
- Given the user submits a priority value that is not P0, P1, or P2
  When the update is attempted
  Then the update is rejected and the ticket is left unchanged.

### FR-3: Group tickets by priority with count badges
The dashboard groups open tickets by priority and shows a count per group.

- Given open tickets of mixed priority are loaded
  When the dashboard renders
  Then tickets are grouped into P0, P1, and P2 sections, and each section header
  shows a badge with the count of open tickets in that group.
- Given a priority group has zero open tickets
  When the dashboard renders
  Then that group shows a count of 0.

### FR-4: API endpoints with validated input
The API exposes read and update endpoints with schema-validated input.

- Given the API is running with seed data
  When a client sends GET /tickets
  Then the API returns HTTP 200 with a JSON array of the tickets.
- Given a valid update body
  When a client sends PATCH /tickets/:id
  Then the API applies the change and returns HTTP 200 with the updated ticket.
- Given an update body that fails Zod validation (for example an invalid priority)
  When a client sends PATCH /tickets/:id
  Then the API rejects it and returns HTTP 400 without changing any data.

### FR-5: CI pipeline passes on pull request
A pull request must pass the automated checks before it can be considered done.

- Given a pull request is opened against the main branch
  When the GitHub Actions pipeline runs
  Then lint, type check, smoke test, and build all complete with exit code 0 and
  the pull request is reported as passing.

## 5. Non-Functional Requirements

### Performance
- NFR-1: Initial dashboard render completes in under 1.5s on localhost with the
  seed data set.
- NFR-2: API read and update endpoints respond with a p95 latency under 150ms
  against the seed data.
- NFR-3: The full CI pipeline (lint, type check, test, build) completes in under
  3 minutes end-to-end.

### Security
- NFR-4: The TypeScript codebase contains zero `any` types (enforced by
  `tsc --noEmit` under strict mode, 0 errors).
- NFR-5: No untrusted input reaches the data layer. 100% of API write payloads
  are schema-validated (Zod) at the request boundary before any state change.
- NFR-6: All commits are signed and follow the Conventional Commits format
  (verified by CI, 0 non-compliant commits allowed).

### Observability
- NFR-7: Every API request emits one structured log line with method, path, HTTP
  status, and response time in ms (100% of requests logged); requests returning
  4xx or 5xx additionally include the error reason (for example the Zod
  validation message or exception type), so failures are diagnosable from logs
  alone.

## 6. Architecture Decision Records

### ADR-001: Framework Choice (Next.js 15, App Router)

**Status:** Accepted

**Context:**
We need a dashboard UI and a small JSON API (GET /tickets, PATCH /tickets/:id)
in one tool that scaffolds fast and renders under 1.5s on localhost (NFR-1).
Keeping the UI and API in one codebase keeps the build and CI simple.

**Decision:**
Use Next.js 15 (App Router) with TypeScript in strict mode. UI lives under
src/app/; the API runs from colocated server routes, so one framework serves
both.

**Consequences:**
- *Easier:* one build, one deploy, one CI pipeline; UI and API share types so
  the ticket shape can't drift; server rendering meets the render target.
- *Harder:* bound to App Router file conventions; heavier than a bare React app.
- *Different:* rendering is server-first by default. Mitigation: keep components
  small and data-focused so we work with App Router patterns, not against them.

**Alternatives:**
- *Plain React SPA (Vite) + standalone Express API, rejected because:* it means
  two builds, two run commands, and CORS between them, doubling the scaffold for
  no benefit at this size.

---

### ADR-002: Data Layer (Prisma + SQLite)

**Status:** Accepted

**Context:**
Tickets seed from a JSON file but must be updated and persist (FR-2). The
scaffold must run locally with no external services, produce a migration that
runs clean in CI, and use typed data access to keep zero `any` types (NFR-4).

**Decision:**
Use Prisma over SQLite. The Ticket entity is defined once in
prisma/schema.prisma, seeded into SQLite on setup; all reads and writes go
through Prisma's typed client.

**Consequences:**
- *Easier:* zero-config local setup and CI (SQLite is one file); typed queries
  support the zero-`any` rule; a real migration satisfies the clean-migration
  check.
- *Harder:* SQLite doesn't match production concurrency or scale; moving to a
  server database later needs a new migration.
- *Different:* data lives in a local file database, not a hosted service.
  Mitigation: route all access through Prisma so a later Postgres swap is a
  config change, not a rewrite.

**Alternatives:**
- *Edit the JSON file directly (no database), rejected because:* no schema, no
  typed queries, no safe concurrent writes, and no migration.
- *PostgreSQL, rejected because:* it needs a running server or container, which
  slows local setup and CI for no gain at seed scale.
