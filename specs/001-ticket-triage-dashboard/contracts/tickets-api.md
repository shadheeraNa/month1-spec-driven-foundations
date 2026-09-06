# Contract: Tickets API

**Feature**: `001-ticket-triage-dashboard` | **Date**: 2026-09-06

The programmatic interface required by FR-009. This is the single write contract:
the dashboard's editor writes through `PATCH` rather than a parallel path, so
validation (FR-008) and logging (FR-010) have exactly one place to live.

Base path: `/api/tickets`. JSON request and response bodies throughout. No
authentication — NG-1, and A-001 assumes a single trusted local user.

---

## Shared types

```jsonc
// Priority — exactly these three values, in this order
"P0" | "P1" | "P2"

// Ticket — as returned by the API
{
  "id":        "string",         // stable identifier; sort key within a group
  "title":     "string",
  "status":    "open" | "closed",
  "priority":  "P0" | "P1" | "P2",
  "ownerName": "string"          // always a member of the known owner list
}

// Error — returned for every 4xx
{
  "error":  "string",            // stable machine-readable code
  "reason": "string"             // human-readable detail; mirrored into the log line
}
```

---

## `GET /api/tickets`

Returns all tickets. Filtering to open tickets and grouping by priority are
presentation concerns handled by the dashboard (FR-003, FR-004), so the endpoint
stays a plain read.

**Request**: no body, no parameters.

**Responses:**

| Status | Body | When |
|---|---|---|
| `200` | `Ticket[]` | Always, on success. Empty array if no tickets exist — not a 404. |
| `500` | `Error` | Data store unreachable. |

**Example — 200:**

```json
[
  { "id": "TKT-001", "title": "VPN access for new joiner", "status": "open",   "priority": "P0", "ownerName": "Oneth" },
  { "id": "TKT-002", "title": "Staging env down",          "status": "closed", "priority": "P1", "ownerName": "Dilini" }
]
```

**Contract notes:**

- Order is by `id` ascending, matching the in-group ordering the dashboard applies
  (FR-013), so the endpoint is deterministic and its tests need no sort.
- Closed tickets **are** included. The dashboard filters them out (FR-003); the API
  does not hide data a caller may legitimately want.

---

## `PATCH /api/tickets/:id`

Updates a ticket's priority, owner, or both. The only write in the system.

**Request body** — at least one field, and no field other than these two:

```jsonc
{
  "priority":  "P0" | "P1" | "P2",  // optional
  "ownerName": "string"             // optional; must exist in the known owner list
}
```

**Responses:**

| Status | Body | When |
|---|---|---|
| `200` | `Ticket` | Update applied. Returns the full updated ticket. |
| `400` | `Error` | Payload failed validation. Nothing written. |
| `404` | `Error` | No ticket with this `id`. Nothing written. |
| `409` | `Error` | Target ticket is closed — not triageable (A-003). Nothing written. |
| `500` | `Error` | Data store unreachable. |

**Error codes:**

| `error` | Cause |
|---|---|
| `invalid_priority` | Priority outside `P0`/`P1`/`P2`. |
| `invalid_owner` | Owner empty, or not in the known owner list. |
| `unsupported_field` | Payload carries a field other than `priority` / `ownerName` — e.g. an attempt to edit `title` or `status` (NG-3). |
| `empty_update` | Neither `priority` nor `ownerName` supplied. |
| `ticket_not_found` | Unknown `id`. |
| `ticket_not_open` | Ticket is closed. |

**Example — 200:**

```json
// PATCH /api/tickets/TKT-001   { "priority": "P1", "ownerName": "Dilini" }
{ "id": "TKT-001", "title": "VPN access for new joiner", "status": "open", "priority": "P1", "ownerName": "Dilini" }
```

**Example — 400:**

```json
// PATCH /api/tickets/TKT-001   { "priority": "URGENT" }
{ "error": "invalid_priority", "reason": "priority must be one of P0, P1, P2; received \"URGENT\"" }
```

**Contract guarantees:**

- **Validation precedes every write.** A rejected request leaves the row
  byte-identical — no partial application of a payload whose second field was
  invalid (FR-008, SC-007, NFR-5).
- **These rejections stay enforced even though the UI cannot trigger them.** The
  dashboard's controls are closed-choice (FR-014), so `invalid_priority` and
  `invalid_owner` are unreachable from the browser. The endpoint is reachable
  independently, so it remains the enforcement point — and the contract tests
  exercise it directly (spec User Story 3, scenarios 3 and 4).
- **Last write wins** on concurrent updates to one ticket (Edge Cases). No
  optimistic concurrency token — single user (A-001).

---

## Cross-cutting: request logging

Every request to either endpoint emits exactly one structured line to stdout
(FR-010, NFR-7), written by the shared `withLogging` wrapper (research.md R2):

```jsonc
// success
{ "method": "GET", "path": "/api/tickets", "status": 200, "durationMs": 12 }

// failure — adds the reason
{ "method": "PATCH", "path": "/api/tickets/TKT-001", "status": 400, "durationMs": 4,
  "reason": "invalid_priority: priority must be one of P0, P1, P2; received \"URGENT\"" }
```

One line per request, never zero and never two — the wrapper is the only emit
point, and it also catches thrown errors, logging the exception type as the reason
before returning 500.

---

## Out of scope

No `POST` and no `DELETE` (NG-3), no endpoint for creating or editing owners
(FR-015), no authentication (NG-1), no ingestion endpoints (NG-2), and no
analytics or reporting endpoints (NG-5). Adding any of these requires amending the
spec first.
