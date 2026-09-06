# Ticket Triage Dashboard

One screen showing every open PMO ticket, grouped into P0/P1/P2 with a count
badge on each, so the number of open P0s is visible without counting by hand.
Priority and owner can be retagged, and the decision persists.

Built from [`prd.md`](./prd.md) via the spec in
[`specs/001-ticket-triage-dashboard/`](./specs/001-ticket-triage-dashboard/).
Governance rules live in [`.specify/memory/constitution.md`](./.specify/memory/constitution.md).

## Requirements

- Node.js 20 LTS or newer
- No database server, no containers, no external services — SQLite is a local file

## Setup

```bash
npm install
cp .env.example .env          # DATABASE_URL for the local SQLite file
npx prisma migrate dev        # creates prisma/dev.db and applies migrations
npm run seed                  # loads owners, then tickets, from data/seed.json
npm run dev                   # http://localhost:3000
```

The seed step reports how many owners and tickets it loaded, and names any
rejected rows.

## Re-running setup is safe

`npm run seed` on an already-seeded database **writes nothing**, reports that
seeding was skipped, and exits 0. Recorded priorities and owners survive.

To deliberately start over:

```bash
npm run db:reset              # DESTRUCTIVE — discards all recorded triage
```

### One consequence worth knowing

The known owner list lives in `data/seed.json`, the same file as the tickets.
Because seeding only runs on an empty database, **editing that file to add a team
member has no effect on a machine that is already seeded.** Picking up the change
requires `npm run db:reset`, which discards recorded triage.

This is a deliberate trade-off for a single-user scaffold with a stable team: the
alternative — re-seeding on every setup run — would make a routine command a
data-loss event. If owners start changing often, the two rules that produce this
(FR-015 and FR-016) should be revisited together rather than worked around.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` — must report 0 errors |
| `npm test` | Vitest: unit, component, contract, integration |
| `npm run seed` | Load seed data if the database is empty |
| `npm run db:reset` | Drop, re-migrate, re-seed (destructive) |

All of lint, typecheck, test, and build must exit 0 before a change is done. CI
runs the same four plus a commit-compliance job that checks the pull request's
own commits are signed and follow Conventional Commits.

## API

Two endpoints, documented in
[`contracts/tickets-api.md`](./specs/001-ticket-triage-dashboard/contracts/tickets-api.md):

- `GET /api/tickets` — all tickets, `id` ascending (closed ones included; the
  dashboard filters them out)
- `PATCH /api/tickets/:id` — change `priority` and/or `ownerName`

The dashboard's controls are closed-choice, so it cannot submit an invalid value.
The endpoint validates anyway, because it is reachable independently — every
rejected request writes nothing at all.

Every request emits exactly one structured JSON log line with method, path,
status, and duration; failures add the reason.

## Layout

```text
prisma/       schema, migrations, seed and reset scripts
data/         seed.json — declared owners plus candidate tickets
src/app/      dashboard page and API route handlers
src/components/  TicketRow, PriorityGroup, TicketEditor
src/lib/      priority domain, Zod schemas, logging, data access, grouping
tests/        unit, component, contract, integration
```

## Not in scope

No authentication, no ingestion from Teams/email/spreadsheets, no ticket
creation or deletion, no notifications, and no analytics beyond the count badges.
These are explicit non-goals — see `prd.md` §3.
