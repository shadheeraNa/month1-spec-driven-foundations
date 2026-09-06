# Quickstart: Ticket Triage Dashboard

**Feature**: `001-ticket-triage-dashboard` | **Date**: 2026-09-06

How to run the feature and confirm it satisfies the spec. Every scenario below maps
to an acceptance criterion, so working through this file end to end is a manual
pass of the feature.

Details are not duplicated here — see [data-model.md](./data-model.md) for entities
and validation rules, and [contracts/tickets-api.md](./contracts/tickets-api.md)
for the request and response contract.

---

## Prerequisites

- Node.js 20 LTS and npm
- No database server, no containers, no external services — SQLite is a local file
  (ADR-002)

---

## Setup

```bash
npm install
npx prisma migrate dev      # creates prisma/dev.db and applies migrations
npm run seed                # loads owners, then tickets, from data/seed.json
npm run dev                 # http://localhost:3000
```

**Expected**: the seed step reports how many owners and tickets it loaded, and
names any rejected rows (FR-012). The dashboard opens on the grouped ticket view.

**Re-running setup is safe.** `npm run seed` on an already-seeded database writes
nothing, reports that seeding was skipped, and exits 0 (FR-016). To deliberately
start over — which **discards recorded triage** — use `npm run db:reset`.

> Note: because the owner list lives in the same seed file (FR-015), editing
> `data/seed.json` to add a team member has no effect on an already-seeded machine.
> Only `db:reset` reloads it. See research.md R5.

---

## Validation scenarios

### S1 — Only open tickets are listed (User Story 1, FR-001..FR-003)

1. Open http://localhost:3000.
2. Compare the tickets shown against `data/seed.json`.

**Expected**: every ticket with `"status": "open"` appears, each showing title,
priority, and owner. No `"status": "closed"` ticket appears anywhere on the page.

### S2 — Groups and count badges (User Story 2, FR-004, FR-005)

1. On the dashboard, read the three section headers.

**Expected**: exactly three sections, in the order **P0, P1, P2**. Each badge count
equals the number of tickets rendered beneath it. A priority with no open tickets
still shows its section, with a badge reading `0` — it is never hidden.

### S3 — In-group ordering is stable (FR-013)

1. Note the order of tickets inside the P1 group.
2. Reload the page. Edit an unrelated ticket in another group, then reload again.

**Expected**: within each group, tickets are ordered by ticket id ascending, and
the order is identical every time. No ticket jumps position because something else
was edited.

### S4 — Retag a ticket and see it move (User Story 3, FR-006, FR-007)

1. Pick an open ticket in the P2 group. Change its priority to **P0** and pick a
   different owner.
2. Reload the page.

**Expected**: the ticket now sits in the P0 group with its new owner. The P0 badge
went up by one and the P2 badge went down by one. After the reload, the change is
still there — it survived, it was not just a UI state (SC-003).

### S5 — The UI cannot submit an invalid value (FR-014)

1. Open the priority control on any ticket, then the owner control.

**Expected**: both are closed-choice — priority offers exactly P0, P1, P2; owner
offers exactly the names declared in the seed file. Neither accepts typed text, so
there is no way to submit an invalid change from the dashboard.

### S6 — The API rejects what the UI cannot send (FR-008, SC-007)

These states are unreachable from the browser by design (S5), so they are verified
against the endpoint directly. Substitute a real ticket id.

```bash
# invalid priority → 400, nothing written
curl -i -X PATCH http://localhost:3000/api/tickets/TKT-001 \
  -H 'Content-Type: application/json' -d '{"priority":"URGENT"}'

# unknown owner → 400, nothing written
curl -i -X PATCH http://localhost:3000/api/tickets/TKT-001 \
  -H 'Content-Type: application/json' -d '{"ownerName":"Nobody"}'

# editing a field that is not editable → 400, nothing written
curl -i -X PATCH http://localhost:3000/api/tickets/TKT-001 \
  -H 'Content-Type: application/json' -d '{"title":"hijacked"}'

# unknown ticket → 404
curl -i -X PATCH http://localhost:3000/api/tickets/NOPE \
  -H 'Content-Type: application/json' -d '{"priority":"P0"}'
```

**Expected**: status codes and `error` codes as listed in the
[contract](./contracts/tickets-api.md). After all four calls, reload the dashboard
and confirm **nothing changed** — no partial writes.

### S7 — Every request is diagnosable from logs alone (FR-010, NFR-7)

1. Watch the `npm run dev` terminal while running S6.

**Expected**: exactly one JSON line per request — never zero, never two. Successful
requests carry method, path, status, and `durationMs`. Failed requests additionally
carry a `reason` naming what was wrong. You should be able to explain every failure
in S6 from the log line alone, without re-reading the curl command.

### S8 — Malformed seed rows never become tickets (FR-012)

1. `npm run db:reset` is required for this, so do it on a throwaway database.
2. Add a ticket to `data/seed.json` with `"priority": "P9"`, and another with an
   `ownerName` not in the `owners` list.
3. Run `npm run db:reset`.

**Expected**: setup reports both rows as rejected, identifying each offending row.
Neither appears on the dashboard, and the dashboard still shows exactly three
priority groups — there is no "untriaged" bucket, because invalid rows never became
tickets (Clarification Q1).

### S9 — Performance budgets (NFR-1, NFR-2)

1. Load the dashboard with the full seed set and check the browser devtools
   Network/Performance panel.
2. Run S6's successful variants a few times and read `durationMs` from the logs.

**Expected**: initial render under **1.5s**; read and update requests comfortably
under **150ms** p95. These are checked manually — CI does not gate on latency
(research.md, Known coverage limits).

---

## Automated checks

```bash
npm run lint            # ESLint
npm run typecheck       # tsc --noEmit — must report 0 errors, zero `any` (NFR-4)
npm test                # Vitest: unit, contract, integration
npm run build           # production build
```

All four must exit 0 before a change is done (FR-011). CI runs the same four
against a fresh database built by `prisma migrate deploy`, and the whole pipeline
must finish inside 3 minutes (NFR-3).
