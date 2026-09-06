# Feature Specification: Ticket Triage Dashboard

**Feature Branch**: `001-ticket-triage-dashboard`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "Read prd.md in this repo and use it as the source of truth. Generate the feature spec for the lightweight ticket triage dashboard for the PMO described there."

## Clarifications

### Session 2026-09-06

- Q: Where should a seed ticket with an unrecognised or missing priority appear on the dashboard? → A: Nowhere — priority is validated at seed load, not at render. A malformed row is rejected before it becomes a ticket, so the dashboard only ever sees P0, P1, or P2.
- Q: Within a single priority group, what order should the tickets be listed in? → A: By ticket identifier, ascending. No date field is required on a ticket.
- Q: When a priority or owner change is rejected, what should the user see? → A: The situation is prevented rather than reported. Both priority and owner are closed-choice controls, so the UI cannot submit an invalid value at all. Rejection remains reachable only through the programmatic interface.
- Q: How is an owner supplied? → A: Selected from a fixed list of known owner names, not typed as free text. This is what makes closed-choice UI controls possible (supersedes the earlier free-text assumption).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See every open ticket in one place (Priority: P1)

Oneth, the PMO coordinator, opens the dashboard at the start of his day and sees
every open internal ticket in a single list, each showing its title, its priority,
and who owns it. He no longer opens Microsoft Teams, his email, and the shared
spreadsheet and reconciles them by hand. Tickets that are already closed do not
appear and do not compete for his attention.

**Why this priority**: This is the whole reason the tool exists. Replacing the
three-source manual reconciliation removes ~30 minutes of daily work on its own,
and every other story in this feature depends on there being one list to look at.
Shipped alone, this is already a usable product.

**Independent Test**: Load the seed data set, open the dashboard, and confirm that
the set of tickets displayed is exactly the set whose status is open, each row
showing title, priority, and owner. No other story needs to exist for this to
deliver value.

**Acceptance Scenarios**:

1. **Given** the seed data set has loaded, **When** the coordinator opens the
   dashboard, **Then** every ticket with status "open" is displayed, each showing
   its title, its priority, and its owner.
2. **Given** a ticket has status "closed" in the seed data, **When** the dashboard
   renders, **Then** that ticket does not appear in the open list.
3. **Given** the seed data set has loaded, **When** the coordinator opens the
   dashboard, **Then** the list is usable within 1.5 seconds of the request.

---

### User Story 2 - Know the P0 count at a glance (Priority: P2)

Open tickets are grouped into P0, P1, and P2 sections, and each section header
carries a badge showing how many open tickets sit in that group. Oneth can answer
"how many P0s are open right now" by looking, not by counting. Genuinely urgent
tickets are visually separated from routine ones instead of sitting beside them.

**Why this priority**: This is the direct fix for the stated pain — urgency is
judged by eye today, and P0 tickets are missed until someone escalates. It builds
on Story 1's list but is independently valuable and independently testable.

**Independent Test**: Load a seed set containing a known mix of P0, P1, and P2
open tickets, render the dashboard, and confirm each group contains exactly the
tickets of that priority and each badge shows the matching count.

**Acceptance Scenarios**:

1. **Given** open tickets of mixed priority are loaded, **When** the dashboard
   renders, **Then** tickets are grouped into P0, P1, and P2 sections and each
   section header shows a badge with the count of open tickets in that group.
2. **Given** a priority group has no open tickets, **When** the dashboard renders,
   **Then** that group is still shown and its badge reads 0.
3. **Given** the seed set contains 6 open P0 tickets, **When** the dashboard
   renders, **Then** the P0 badge reads 6 and the P0 section contains 6 tickets.

---

### User Story 3 - Triage a ticket by setting priority and owner (Priority: P3)

Oneth reviews a ticket, decides how urgent it really is, and records that decision
by setting its priority to P0, P1, or P2 and naming the person who owns it. The
ticket moves to the matching priority group, the affected badge counts update, and
the decision survives a page reload — so tomorrow morning he starts from his
triage, not from scratch.

**Why this priority**: Reading the queue is the immediate relief; recording triage
decisions is what stops the queue from decaying back into guesswork. It is the
last of the three to be strictly necessary, but without it the dashboard is
read-only and the seed priorities are never corrected.

**Independent Test**: Change one displayed ticket's priority and owner, confirm the
ticket appears under its new priority group with updated counts, then reload the
dashboard and confirm the change is still there.

**Acceptance Scenarios**:

1. **Given** an open ticket is displayed, **When** the coordinator sets its
   priority to P0, P1, or P2 and assigns an owner, **Then** the ticket's priority
   and owner are updated and the change persists across a reload.
2. **Given** an open ticket is displayed in the P2 group, **When** the coordinator
   changes its priority to P0, **Then** the ticket appears in the P0 group, the P0
   badge count increases by one, and the P2 badge count decreases by one.
3. **Given** a request is sent directly to the update interface carrying a
   priority value that is not P0, P1, or P2, **When** the update is attempted,
   **Then** it is rejected with a client error and the ticket is left unchanged.
   *(Tested against the programmatic interface — the dashboard's priority control
   is closed-choice and cannot produce this value.)*
4. **Given** a request is sent directly to the update interface carrying an empty
   owner or a name outside the known owner list, **When** the update is attempted,
   **Then** it is rejected with a client error and the ticket is left unchanged.
   *(Tested against the programmatic interface — the dashboard's owner control is
   closed-choice and cannot produce this value.)*
5. **Given** the coordinator is editing a ticket in the dashboard, **When** they
   open the priority and owner controls, **Then** each offers only valid choices —
   P0, P1, P2 for priority and the known owner names for owner — so no invalid
   change can be submitted from the UI.

---

### Edge Cases

- **No open tickets at all.** All three priority groups render with a badge of 0
  and the dashboard shows an empty state rather than a blank page or an error.
- **Every open ticket is one priority.** The two empty groups still render with
  badges reading 0 (they are never hidden), so the absence of P0s is a visible
  fact rather than a missing section.
- **A seed row has an unrecognised priority or no priority.** It is rejected at
  seed load and never becomes a ticket, so this never reaches the dashboard. The
  rejection is recorded with the offending row identified, so the seed file can be
  corrected rather than the problem being discovered as a missing ticket.
- **Update aimed at a ticket that does not exist.** The request is rejected with a
  not-found error and nothing is written.
- **Update aimed at a closed ticket.** Closed tickets are out of scope for triage;
  the request is rejected and the ticket is unchanged.
- **Two updates to the same ticket in quick succession.** The last accepted update
  wins and the stored ticket is never left in a partially-updated state.
- **Update carries fields beyond priority and owner** (for example an attempt to
  change the title or status). The unsupported fields are rejected rather than
  written, since title and status are not editable in this scope.
- **Update names an owner outside the known owner list.** Reachable only through
  the programmatic interface, since the dashboard's owner control is closed-choice
  (FR-014). The request is rejected and the ticket is unchanged.
- **A seed ticket's owner is not in the known owner list.** Caught at seed load by
  the same membership check, so the dashboard never displays an owner the owner
  control cannot re-select.
- **Data store is unavailable when the dashboard loads.** The coordinator sees an
  explicit failure message, not an empty list that would read as "no open work".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dashboard MUST display every ticket whose status is open, loaded
  from the seed data set. *(prd.md FR-1)*
- **FR-002**: Each displayed ticket MUST show, at minimum, its title, its priority,
  and its owner. *(prd.md FR-1)*
- **FR-003**: Tickets whose status is not open MUST NOT appear in the dashboard's
  open list. *(prd.md FR-1)*
- **FR-004**: The dashboard MUST group open tickets into exactly three priority
  groups — P0, P1, and P2 — and MUST render all three groups on every load,
  including groups containing no tickets. *(prd.md FR-3)*
- **FR-005**: Each priority group header MUST display a count badge equal to the
  number of open tickets in that group; an empty group's badge MUST read 0.
  *(prd.md FR-3)*
- **FR-006**: A user MUST be able to set an open ticket's priority to P0, P1, or
  P2, and MUST be able to assign or change its owner by selecting from the known
  owner list. *(prd.md FR-2)*
- **FR-007**: An accepted priority or owner change MUST persist, and MUST be
  reflected in the grouped view and in the affected count badges without requiring
  the user to reconcile anything by hand. *(prd.md FR-2, G-3)*
- **FR-008**: Every update MUST be validated against a defined schema before any
  stored data changes. An update carrying a priority outside {P0, P1, P2}, an
  empty owner, an owner outside the known owner list, an unknown ticket, or an
  unsupported field MUST be rejected with an error and MUST leave all stored data
  unchanged. This validation MUST NOT be relaxed on the grounds that the UI cannot
  produce such a request (FR-014) — the programmatic interface is reachable
  independently and remains the enforcement point. *(prd.md FR-2, FR-4;
  constitution Principle II)*
- **FR-009**: The system MUST expose a programmatic read interface returning the
  tickets, and a programmatic update interface accepting a priority and owner
  change for a single ticket, so the dashboard and any future caller share one
  contract. Successful reads and updates report success; rejected updates report a
  client error. *(prd.md FR-4)*
- **FR-010**: Every request to the read or update interface MUST produce exactly
  one structured log entry recording the operation, the target, the outcome, and
  the elapsed time; entries for failed requests MUST additionally record the
  reason for failure, so a failure is diagnosable from the logs alone. *(prd.md
  NFR-7; constitution Principle IV)*
- **FR-011**: A change MUST NOT be considered complete until the automated check
  pipeline — lint, type check, smoke test, and build — passes on its pull request.
  *(prd.md FR-5; constitution Principle V)*
- **FR-012**: Seed data MUST be validated as it is loaded. A seed row whose
  priority is not P0, P1, or P2, whose owner is not in the known owner list, or
  which is missing a required attribute, MUST be rejected at load time and MUST
  NOT become a ticket. Each rejection MUST be recorded with the offending row
  identified so the seed file can be corrected. Because of this, every ticket the
  dashboard can display carries a valid priority and a selectable owner.
  *(prd.md FR-1; constitution Principle II)*
- **FR-013**: Within each priority group, tickets MUST be listed in ascending order
  of ticket identifier. The order MUST be identical across reloads and MUST NOT
  depend on when a ticket was last updated, so a ticket never changes position
  within its group as a side effect of an unrelated edit. *(supports G-1)*
- **FR-014**: The dashboard's priority and owner inputs MUST both be closed-choice
  controls — priority offering exactly P0, P1, and P2, and owner offering exactly
  the known owner names. The UI MUST NOT permit free-text entry for either field,
  so an invalid change cannot be submitted from the dashboard. Rejection handling
  (FR-008) therefore applies to the programmatic interface, which remains
  independently reachable.

#### Explicitly Out of Scope

The following are excluded by prd.md section 3 and are binding constraints on this
feature, not deferred work:

- **OOS-001**: No user authentication, accounts, or role-based access. *(NG-1)*
- **OOS-002**: No automatic ingestion from Microsoft Teams, email, or the existing
  shared spreadsheet. Tickets come from the seed data set only. *(NG-2)*
- **OOS-003**: No ticket creation or deletion through the interface, and no
  editing of a ticket's title or status. Priority and owner are the only editable
  fields. *(NG-3)*
- **OOS-004**: No notifications, reminders, or escalation alerts. *(NG-4)*
- **OOS-005**: No reporting or analytics beyond the per-priority count badges.
  *(NG-5)*

### Key Entities

- **Ticket**: One internal request raised against a delivery team. Carries a
  stable identifier, a title describing the request, a status (open or closed —
  read-only in this feature), a priority of P0, P1, or P2, and an owner naming the
  person responsible. Priority and owner are the only attributes a user may change.
- **Known owner list**: The fixed set of person names that may be assigned as a
  ticket's owner. It is the source of the owner control's choices and the
  membership check applied to every update. Read-only in this feature — the
  dashboard offers no way to add, rename, or remove an owner.
- **Priority group**: A view-level grouping of open tickets sharing one priority
  value. Always exactly three groups (P0, P1, P2), each carrying a count of the
  open tickets it holds. Derived from tickets; not stored independently.
- **Seed data set**: The fixed collection of candidate tickets the system starts
  from. The sole source of tickets in this feature — it is validated and loaded
  once at setup, after which triage decisions made in the dashboard are the source
  of truth. A row that fails validation is rejected at load and never becomes a
  Ticket, so a Ticket always carries a valid priority.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The coordinator can see all open tickets without opening any other
  tool, replacing the current three-source manual reconciliation. *(G-1)*
- **SC-002**: The number of open P0 tickets is readable from the screen without
  counting, sorting, or filtering by hand. *(G-2)*
- **SC-003**: A priority or owner change made by the coordinator is visible in the
  correct priority group, with corrected counts, before they move to the next
  ticket. *(G-3)*
- **SC-004**: The dashboard is usable within 1.5 seconds of being opened with the
  seed data set. *(G-4, NFR-1)*
- **SC-005**: 95% of read and update operations complete within 150 milliseconds
  against the seed data set. *(G-5, NFR-2)*
- **SC-006**: The daily reconciliation effort drops from roughly 30 minutes to
  under 5 minutes, recovering about 2 hours per week. *(prd.md section 2 impact)*
- **SC-007**: 100% of rejected updates leave stored data unchanged — no partial
  writes. *(NFR-5)*
- **SC-008**: 100% of read and update requests produce a diagnosable log entry,
  and every failed request's log entry states why it failed. *(NFR-7)*
- **SC-009**: The full automated check pipeline completes in under 3 minutes.
  *(NFR-3)*

## Assumptions

Reasonable defaults chosen where prd.md did not specify. Each is cheap to change
if wrong; flag any that do not match intent before planning.

- **A-001**: A single trusted internal user (the PMO coordinator) uses the tool.
  With no authentication in scope (NG-1), the dashboard is not exposed to
  untrusted users, and "who made this change" is not tracked.
- **A-002**: An owner is chosen from a fixed list of known owner names, not typed
  as free text. This is what allows both editable fields to be closed-choice
  controls (FR-014), so the dashboard cannot submit an invalid change. Validation
  therefore checks membership of the known owner list, not merely non-emptiness.
- **A-003**: Ticket status is read-only. prd.md FR-2 names only priority and owner
  as editable, and NG-3 excludes creation and deletion, so closing a ticket is not
  part of this feature.
- **A-004**: The seed data set is loaded once during setup. Re-running setup does
  not silently overwrite triage decisions already recorded, since that would
  destroy the work the tool exists to capture.
- **A-005**: Tickets are viewed on a desktop browser during the coordinator's
  morning review. Mobile layout is not a requirement for this version.
- **A-006**: The seed data set is representative of a normal week — roughly 40 to
  60 tickets — so the dashboard is not designed for pagination, virtualisation, or
  search at this stage.
- **A-007**: Ticket identifiers are stable and sortable, since they are the sort
  key within a priority group (FR-013). No creation or modification timestamp is
  required on a ticket for this feature.
- **A-008**: Performance targets are measured on a local development machine
  against the seed data set, as stated in prd.md section 5.

## Dependencies

- **D-001**: A seed data set of tickets, each with an identifier, title, status,
  priority, and owner, must exist before the dashboard can display anything.
- **D-003**: A known owner list must exist before any ticket can be loaded or
  reassigned, since it supplies the owner control's choices and the membership
  check applied at both seed load (FR-012) and update (FR-008).
- **D-002**: The technical stack and quality constraints are fixed by the accepted
  decision records in prd.md section 6 and by `.specify/memory/constitution.md`.
  This spec states what the feature must do; those documents govern how it is
  built.
