# Phase 0 Research: Ticket Triage Dashboard

**Feature**: `001-ticket-triage-dashboard` | **Date**: 2026-09-06

The stack itself was not researched — ADR-001 (Next.js 15 App Router) and ADR-002
(Prisma + SQLite) are accepted decisions in `prd.md`, and the constitution makes
substituting them an amendment. What follows resolves the choices those ADRs left
open, plus two constraints discovered while designing against them.

All `NEEDS CLARIFICATION` items from Technical Context are resolved below. None
remain.

---

## R1: Test framework and what "smoke test" means

**Decision**: Vitest for all three test layers (unit, contract, integration).
Route handlers are imported and invoked as plain functions against a temporary
SQLite file — no HTTP listener, no browser driver. The CI "smoke test" of FR-011 is
an integration test that renders the dashboard's data path against a known seed and
asserts the three groups and their counts.

**Rationale**: NFR-3 caps the entire pipeline at 3 minutes, and browser automation
is the single most expensive thing that could go in it — a Playwright install alone
can consume most of that budget on a cold CI runner. Vitest is TypeScript- and
ESM-native, so it needs no separate transform config to satisfy Principle I, and it
runs this suite in seconds. Next.js route handlers are ordinary exported async
functions taking a `Request`, which makes them directly callable in-process; that
tests the real handler, real Zod schema, and real Prisma client without a network
hop.

**Alternatives considered**:

- *Playwright end-to-end tests* — rejected for now on the 3-minute budget. This is
  the one rejection worth revisiting: it means FR-014 (the controls are genuinely
  closed-choice in a browser) is verified by component-level assertions rather than
  by driving a real browser. Recorded as a known coverage limit below.
- *Jest* — rejected: needs `next/jest` plus transform configuration to handle TS
  and ESM, which is setup cost for no gain over Vitest here.
- *Node's built-in `node:test`* — rejected: workable, but no watch mode or
  assertion ergonomics, and React component rendering would need extra wiring.

---

## R2: How to emit exactly one structured log line per API request

**Decision**: A `withLogging` higher-order function in `src/lib/logger.ts` that
wraps each route handler. It records the start time, awaits the handler, and emits
one `JSON.stringify` line to stdout containing method, path, status, and duration
in milliseconds — adding a `reason` field when the status is 4xx or 5xx. It catches
thrown errors, logs the exception type as the reason, and re-raises as a 500. No
logging dependency is added.

**Rationale**: Next.js `middleware.ts` cannot satisfy NFR-7. It runs on the Edge
runtime by default and, more decisively, it executes *before* the route handler and
does not observe the final response status or duration — so it can log that a
request arrived, not how it ended. NFR-7 requires status and elapsed time in the
same line, which only a wrapper around the handler can produce. Doing it as a
wrapper also makes "exactly one line" structural: there is one emit point, so
double-logging is not reachable.

Writing ~25 lines rather than adding pino follows Principle III directly. The
requirement is one JSON line on stdout; a logging library's value is transports,
redaction, child loggers, and level routing, none of which this feature asks for.

**Alternatives considered**:

- *pino* — rejected under Principle III. It is the right choice for a service with
  real log routing needs; here it adds a dependency and transport configuration to
  produce output a one-line `JSON.stringify` already produces.
- *`middleware.ts`* — rejected: cannot see response status or duration, as above.
- *Logging inside each handler body* — rejected: duplicates the rule at every call
  site, and an early `return` on a validation failure would silently skip it, which
  is exactly the 4xx case NFR-7 most cares about.

---

## R3: How the UI writes, given FR-009 requires a programmatic interface anyway

**Decision**: The dashboard reads by calling into `src/lib/tickets.ts` directly
from a server component, and writes by `fetch`ing `PATCH /api/tickets/:id` from a
client component, then calling `router.refresh()` to re-render the server
component with updated groups and counts.

**Rationale**: FR-009 requires the read and update interfaces to exist as a shared
contract regardless. Having the UI write through that same contract means the
happy path is exercised by every manual use of the dashboard, and there is exactly
one place where a write is validated and logged. Reading is different: a server
component can query Prisma in-process, so routing the read through HTTP would add a
network round trip inside the 1.5s render budget for no benefit.

**Alternatives considered**:

- *Server Actions for the write* — rejected: it would create a second write path
  alongside the required PATCH endpoint, so validation and logging would either be
  duplicated or apply to only one of them. That directly strains Principle II.
- *Client-side fetch for the read too* — rejected: introduces a loading waterfall
  on first paint and works against NFR-1.

---

## R4: Seeding, migrations, and CI database setup

**Decision**: The SQLite file is gitignored and rebuilt in CI. The pipeline runs
`prisma migrate deploy` against a fresh file, then the seed script. Migrations are
committed. Local setup is `npm install && npx prisma migrate dev && npm run seed`.

**Rationale**: ADR-002 requires a real migration that runs clean in CI, which means
migrations are source and the database file is a build artefact. Committing a
binary `.db` would create merge conflicts and let schema drift hide behind a stale
file. `migrate deploy` (not `migrate dev`) is correct for CI: it applies committed
migrations without prompting or generating new ones.

**Alternatives considered**:

- *`prisma db push` in CI* — rejected: it syncs the schema without producing or
  verifying a migration, so the clean-migration requirement would go untested.
- *Committing `dev.db`* — rejected for the drift and conflict reasons above.

---

## R5: Making seeding conditional (FR-016)

**Decision**: The seed script counts existing tickets first. If the count is
non-zero it writes nothing, prints a message naming how many tickets were found and
that seeding was skipped, and exits 0. Re-seeding requires a separate `db:reset`
script that drops and recreates the database before seeding, and which prints what
it is about to destroy. Owners are loaded before tickets, since ticket rows are
validated against the owner list.

**Rationale**: FR-016 requires an ordinary setup re-run to be a no-op that preserves
triage. Exiting 0 rather than erroring matters because `npm run seed` sits in the
documented setup path and in CI; a non-zero exit would fail the pipeline on a
correct, expected condition. Keeping reset as a distinct, separately named command
means the destructive path can never be reached by the routine one.

**Known consequence, carried from A-004**: because the owner list lives in the same
seed file (FR-015), editing that file to add a team member has no effect on an
already-seeded machine — only `db:reset` reloads it, and that discards recorded
triage. Accepted for a single-user scaffold with a stable team. If owners begin
changing often, FR-015 and FR-016 should be revisited together rather than patched
individually.

**Alternatives considered**:

- *Upsert-style merge* — rejected during clarification (Q5): "never overwrite an
  existing priority" is a rule that has to be right on every field forever, and
  getting it wrong silently destroys triage.
- *Always reset* — rejected: makes routine setup a data-loss event.

---

## R6: Prisma does not support enums on SQLite

**Decision**: `Ticket.priority` and `Ticket.status` are stored as `String`. The
three-value constraint is expressed as a TypeScript union
(`type Priority = 'P0' | 'P1' | 'P2'`) derived from a single `const` array, and
enforced by Zod at both write boundaries (FR-008, FR-012).

**Rationale**: This is a platform constraint discovered while designing the schema,
not a preference — `enum` blocks are only valid for providers that support them,
and SQLite is not one of them. It matters because the naive reading of "priority is
one of exactly three values" is a database enum, and that will not compile.

The mitigation is stronger than it first appears: because every write passes
through Zod (Principle II) and the seed loader rejects malformed rows before they
become tickets (FR-012), an invalid priority has no path into the table. The
TypeScript union means reads are typed as the three values, keeping Principle I's
zero-`any` rule intact. The single `const` array is also what orders the groups
(P0, P1, P2) and guarantees all three render even when empty (FR-004, FR-005).

**Alternatives considered**:

- *Switching to PostgreSQL for native enum support* — rejected: ADR-002 explicitly
  rejected Postgres for needing a running server, and this would be a stack change
  requiring a constitution amendment for a constraint that Zod already handles.
- *A separate `Priority` lookup table with a foreign key* — rejected under
  Principle III. It would buy database-level enforcement, but priorities are a
  fixed, tiny, never-edited set, unlike owners (which earned a table because they
  are declared data that changes).

---

## R7: Owner as a foreign key, not a string field

**Decision**: An `Owner` table keyed by name, with `Ticket.ownerName` as a foreign
key referencing it. Membership validation is therefore enforced by the database as
well as by Zod.

**Rationale**: FR-008 requires rejecting an owner outside the known list, and
FR-012 requires the same check at seed load. A foreign key makes the invalid write
impossible at the storage layer rather than merely unlikely, which is the stronger
reading of Principle II. It also gives the owner control's choices a single query
(`SELECT name FROM Owner`) that cannot disagree with what the validator accepts.

Keying by `name` rather than a synthetic id keeps `Ticket.ownerName` directly
displayable with no join for the common read path, which suits the 1.5s render
budget. The trade-off — renaming an owner would require updating referencing rows —
is irrelevant here because the list is read-only in this feature (FR-015).

**Alternatives considered**:

- *`Ticket.owner` as a plain `String`, validated only in application code* —
  rejected: leaves the database able to hold an owner the UI cannot offer.
- *Synthetic integer `Owner.id`* — rejected: adds a join to every dashboard read to
  display a name, for a benefit (cheap renames) the feature explicitly does not need.

---

## Known coverage limits

Recorded here so they are visible at planning time rather than discovered during
verification:

1. **FR-014 is verified at component level, not in a real browser.** A component
   test (tasks.md T036) asserts both controls offer only their fixed values and
   accept no typed input; what is *not* covered is real browser behaviour such as
   native select rendering or autofill. The security-relevant half of the
   requirement — that the API rejects the values regardless — is covered by
   contract tests, so an escape here would be a usability bug, not a
   data-integrity one.
2. **Performance budgets are asserted, not measured in CI.** NFR-1 and NFR-2 are
   verified manually against a local run per the quickstart. Adding a latency gate
   to CI would risk flakiness on shared runners and eat the 3-minute budget.
