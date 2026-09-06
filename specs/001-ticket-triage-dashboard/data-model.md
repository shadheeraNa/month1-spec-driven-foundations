# Phase 1 Data Model: Ticket Triage Dashboard

**Feature**: `001-ticket-triage-dashboard` | **Date**: 2026-09-06

Derived from the spec's Key Entities, with validation rules traced to the
functional requirements they enforce. Storage is SQLite via Prisma (ADR-002).

---

## Entities

### Owner

The known owner list (FR-015) — the fixed set of people a ticket may be assigned
to. Declared in the seed file, read-only in this feature.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `name` | `String` | Primary key | The displayable person name. Keyed by name so the common read path needs no join (research.md R7). |

**Rules:**

- Loaded from the seed file's explicit `owners` declaration, never derived from the
  owners appearing on ticket rows (FR-015).
- Must be loaded before any ticket row is validated, since ticket owners are
  checked against it (D-003).
- A seed file declaring zero owners fails setup rather than loading with an empty
  owner control (FR-015).
- No create, rename, or delete path exists in the UI or API (FR-015, NG-3).

### Ticket

One internal request raised against a delivery team.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `String` | Primary key | Stable identifier; also the sort key within a priority group (FR-013). |
| `title` | `String` | Required, non-empty | Displayed on every row (FR-002). Not editable (NG-3). |
| `status` | `String` | Required, one of `open` \| `closed` | Read-only in this feature (A-003). Stored as `String` — SQLite has no enum support (research.md R6). |
| `priority` | `String` | Required, one of `P0` \| `P1` \| `P2` | Editable. Typed as a TS union, enforced by Zod at both write boundaries (research.md R6). |
| `ownerName` | `String` | Required, foreign key → `Owner.name` | Editable. The FK makes an unknown owner unwritable at the storage layer (research.md R7). |

**Relationships:**

- `Ticket.ownerName` → `Owner.name`, many-to-one. Every ticket has exactly one
  owner; an owner may hold many tickets, or none (which is precisely why the list
  is declared rather than derived — Q4).

**Rules:**

- `priority` and `ownerName` are the only mutable fields. An update naming any
  other field is rejected rather than partially applied (FR-008).
- `ownerName` is required, not nullable. FR-002 requires every displayed ticket to
  show an owner, and FR-008/FR-012 reject an empty owner at both boundaries — so a
  ticket with no owner has no legal way to exist.
- Only `status = 'open'` tickets appear on the dashboard (FR-003). Closed tickets
  remain stored and are rejected as update targets (Edge Cases).

---

## Derived, not stored

### Priority group

A view-level grouping (FR-004). Computed on read; never persisted.

- Exactly three groups, always rendered in the fixed order **P0, P1, P2**, from a
  single `const` array that is also the source of the `Priority` union type.
- A group with no open tickets still renders, with a badge reading `0` (FR-005).
  Because the list of groups comes from the constant rather than from the data, an
  empty group cannot silently disappear.
- Each group's badge count equals the number of open tickets it holds (FR-005).
- Tickets within a group are ordered by `id` ascending, stable across reloads and
  independent of update recency (FR-013).

---

## Validation rules

Both write boundaries import the same Zod schemas from `src/lib/schemas.ts`, so
each rule is stated once (Principle II).

### Boundary 1 — `PATCH /api/tickets/:id` (FR-008)

| Rule | Rejection |
|---|---|
| `priority`, if present, is `P0`, `P1`, or `P2` | 400, no write |
| `ownerName`, if present, is non-empty and exists in `Owner` | 400, no write |
| No field other than `priority` and `ownerName` is present | 400, no write |
| At least one of `priority` / `ownerName` is present | 400, no write |
| Target ticket exists | 404, no write |
| Target ticket has `status = 'open'` | 409, no write |

Validation runs to completion before any write, so a rejected request leaves the
row byte-identical (SC-007). This is enforced regardless of the UI being
structurally unable to produce these payloads (FR-014) — the endpoint is reachable
independently.

### Boundary 2 — seed load (FR-012)

| Rule | Behaviour on failure |
|---|---|
| `owners` is present and non-empty | Setup fails |
| Each ticket row has `id`, `title`, `status`, `priority`, `ownerName` | Row rejected, not loaded |
| `priority` is `P0`, `P1`, or `P2` | Row rejected, not loaded |
| `status` is `open` or `closed` | Row rejected, not loaded |
| `ownerName` is in the declared owner list | Row rejected, not loaded |
| `id` is unique within the file | Row rejected, not loaded |

Every rejection is reported with the offending row identified, so the seed file can
be corrected rather than the problem surfacing later as a missing ticket (FR-012).
Because of this boundary, the dashboard never encounters an invalid priority — this
is what removed the need for a fourth "untriaged" group (Clarification Q1).

---

## State and lifecycle

There is no state machine in this feature. `status` is read-only (A-003), so a
ticket never transitions between open and closed while the tool is running. The
only mutations are field edits to `priority` and `ownerName`.

**Concurrency**: last accepted write wins (Edge Cases). Each update is a single-row
write inside one Prisma call, so a rejected or interleaved request cannot leave a
row partially updated. No optimistic locking — there is one user (A-001).

**Seeding lifecycle**: seeding is conditional on an empty store (FR-016). An
ordinary re-run writes nothing and reports the skip. The separate reset path drops
and rebuilds, discarding recorded triage — see research.md R5 for the consequence
this carries for adding owners.
