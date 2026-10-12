---
description: "Task list for Ticket Triage Dashboard implementation"
---

# Tasks: Ticket Triage Dashboard

**Input**: Design documents from `/specs/001-ticket-triage-dashboard/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/tickets-api.md](./contracts/tickets-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included. Not optional here — `prd.md` FR-5 and constitution Principle V make lint, type check, test, and build merge-blocking, so test tasks are part of the definition of done rather than an add-on.

**Organization**: Tasks are grouped by user story so each can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are given in every task

## Path Conventions

Single Next.js project at repository root (ADR-001): `src/app/`, `src/components/`,
`src/lib/`, `prisma/`, `data/`, `tests/`. See plan.md → Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, tooling, and the CI gate

- [X] T001 Initialize Next.js 15 App Router project with TypeScript at repository root: `package.json`, `next.config.ts`, `src/app/layout.tsx`
- [X] T002 Configure TypeScript strict mode in `tsconfig.json` — `strict: true`, `noUncheckedIndexedAccess: true`; add `typecheck` script running `tsc --noEmit` (NFR-4, Principle I)
- [X] T003 [P] Install and pin runtime dependencies in `package.json`: `next@15`, `react@19`, `@prisma/client@6`, `zod@4`
- [X] T004 [P] Install and pin dev dependencies in `package.json`: `prisma@6`, `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `jsdom`, `tsx`, `eslint`, `eslint-config-next`, `@commitlint/cli`, `@commitlint/config-conventional`
- [X] T005 [P] Configure ESLint in `eslint.config.mjs` with `next/core-web-vitals` plus a rule banning explicit `any` (Principle I)
- [X] T006 [P] Configure Vitest in `vitest.config.ts` — `@vitejs/plugin-react`, default `node` environment with `jsdom` applied to `tests/component/**`, `tests/**` include, path alias `@/` → `src/` (research.md R1)
- [X] T007 [P] Create `.gitignore` covering `node_modules/`, `.next/`, `prisma/dev.db`, `prisma/dev.db-journal` — the database file is a build artefact, never committed (research.md R4)
- [X] T008 [P] Create CI workflow in `.github/workflows/ci.yml`: Node 20, `npm ci`, `npx prisma migrate deploy`, then lint → typecheck → test → build, each required to exit 0 (FR-011, NFR-3)
- [X] T009 [P] Add the commit-compliance job to `.github/workflows/ci.yml` plus config in `commitlint.config.mjs`: run `commitlint --from origin/${{ github.base_ref }} --to HEAD` for message format, and check signature status for the pull request's commits only via `gh api repos/{owner}/{repo}/pulls/{n}/commits --jq '.[] | select(.commit.verification.verified == false) | .sha'`, failing if any are returned. Scoped to the PR range so pre-gate spec-authoring commits are untouched (FR-011, NFR-6, constitution Principle V)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The schema, seed pipeline, validation, logging, and data access every user story sits on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T010 Define `Ticket` and `Owner` models in `prisma/schema.prisma` per data-model.md — `Owner.name` as primary key, `Ticket.ownerName` as a foreign key to it, `priority`/`status` as `String` (Prisma has no SQLite enums — research.md R6, R7)
- [X] T011 Generate the initial migration into `prisma/migrations/` via `npx prisma migrate dev --name init` and verify it applies to an empty database (ADR-002, research.md R4)
- [X] T012 [P] Create the Prisma client singleton in `src/lib/db.ts`, guarded against hot-reload duplication in development
- [X] T013 [P] Define the priority domain in `src/lib/priority.ts`: a `PRIORITIES` const array `['P0','P1','P2']` as the single source of both the `Priority` union type and the fixed group render order, plus the `TicketStatus` union (research.md R6, FR-004)
- [X] T014 [P] Implement the `withLogging` route-handler wrapper in `src/lib/logger.ts` — emits exactly one JSON line with `method`, `path`, `status`, `durationMs`; adds `reason` on 4xx/5xx; catches thrown errors, logs the exception type, and re-raises as 500 (FR-010, NFR-7, research.md R2)
- [X] T015 Define Zod schemas in `src/lib/schemas.ts` shared by both write boundaries: `ticketUpdateSchema` (strict — rejects unknown fields, requires at least one of `priority`/`ownerName`) and `seedFileSchema` (owners non-empty, ticket rows fully validated). Depends on T013 (FR-008, FR-012, Principle II)
- [X] T016 [P] Create the seed data file `data/seed.json` with a declared `owners` array and ~40–60 candidate tickets spanning all three priorities, including at least one `closed` ticket and at least one priority group left empty (FR-015, A-006, exercises FR-003 and FR-005)
- [X] T017 Implement the seed script in `prisma/seed.ts` in this order: (1) parse and validate the whole seed file through `seedFileSchema`, failing setup if `owners` is empty or the file is malformed; (2) check whether the store is already non-empty and, if so, print the skip and exit 0 without writing; (3) otherwise load owners, then tickets, rejecting and reporting offending rows individually without aborting the run. Validation precedes the empty-store check so a bad file never passes unnoticed on a seeded machine. Depends on T015, T016 (FR-012, FR-015, FR-016, research.md R5)
- [X] T018 Add `seed` and `db:reset` scripts to `package.json` — `db:reset` drops, re-migrates, and re-seeds, and prints what it will destroy before doing it. Depends on T017 (FR-016)
- [X] T019 Implement typed data access in `src/lib/tickets.ts`: `listTickets()` (all tickets, `id` ascending), `listOpenTickets()`, `listOwnerNames()`, and `updateTicket()`. All access goes through the Prisma client with no `any` (Principle I, FR-013)
- [X] T020 [P] Create the test database helper in `tests/helpers/db.ts` — provisions a temporary SQLite file per suite, applies migrations, and tears it down, so tests never touch `prisma/dev.db`
- [X] T021 [P] Unit-test the Zod schemas in `tests/unit/schemas.test.ts`: valid updates pass; invalid priority, empty owner, unknown field, and empty payload each fail. Depends on T015
- [X] T022 Integration-test the seed pipeline in `tests/integration/seed.test.ts`: a clean seed loads the expected counts; malformed rows are rejected and reported without becoming tickets; a second run on a non-empty store writes nothing and exits 0; and a seed file with an empty `owners` list fails setup even when the store is already populated. Depends on T017, T020 (FR-012, FR-015, FR-016)

**Checkpoint**: Schema, seed, validation, logging, and data access are in place — user stories can now begin

---

## Phase 3: User Story 1 - See every open ticket in one place (Priority: P1) 🎯 MVP

**Goal**: One screen listing every open ticket with its title, priority, and owner — replacing the three-source manual reconciliation.

**Independent Test**: Load the seed set, open the dashboard, and confirm the tickets shown are exactly those with `status: "open"`, each showing title, priority, and owner, with no closed ticket anywhere on the page.

### Tests for User Story 1

- [X] T023 [P] [US1] Contract test for `GET /api/tickets` in `tests/contract/tickets-get.test.ts`: returns 200 with a JSON array, `id` ascending, closed tickets included, empty array (not 404) when no tickets exist. Depends on T020 (FR-009, contracts/tickets-api.md)
- [X] T024 [P] [US1] Integration test in `tests/integration/dashboard-list.test.ts`: the dashboard's data path returns only open tickets, each carrying title, priority, and owner. Depends on T020 (FR-001, FR-002, FR-003)

### Implementation for User Story 1

- [X] T025 [US1] Implement `GET /api/tickets` in `src/app/api/tickets/route.ts`, wrapped in `withLogging`, returning all tickets `id` ascending per the contract. Depends on T014, T019
- [X] T026 [P] [US1] Build the ticket row component in `src/components/TicketRow.tsx` displaying title, priority, and owner (FR-002)
- [X] T027 [US1] Build the dashboard page in `src/app/page.tsx` as a server component calling `listOpenTickets()` directly — no client fetch on first paint, to hold the 1.5s render budget. Renders rows via `TicketRow`. Depends on T019, T026 (FR-001, NFR-1, research.md R3)

**Checkpoint**: The dashboard lists open tickets and is independently demoable — this is the MVP

---

## Phase 4: User Story 2 - Know the P0 count at a glance (Priority: P2)

**Goal**: Open tickets grouped into P0/P1/P2 sections, each header carrying a count badge, so the number of open P0s is readable without counting.

**Independent Test**: Load a seed set with a known mix of priorities and confirm each section contains exactly its own tickets, each badge matches, and a priority with no open tickets still renders with a badge of `0`.

### Tests for User Story 2

- [X] T028 [P] [US2] Unit-test grouping in `tests/unit/grouping.test.ts`: tickets land in the right group; all three groups are always returned in P0/P1/P2 order even when empty; counts match group contents; in-group order is `id` ascending and unaffected by update recency (FR-004, FR-005, FR-013)
- [X] T029 [P] [US2] Integration test in `tests/integration/dashboard-groups.test.ts` — the CI smoke test: the dashboard renders exactly three groups with correct badge counts against a known seed, including a group whose badge reads `0`. Depends on T020 (FR-011, NFR-3)

### Implementation for User Story 2

- [X] T030 [P] [US2] Implement `groupByPriority()` in `src/lib/grouping.ts` — maps open tickets into all three groups derived from the `PRIORITIES` const so an empty group can never be omitted, preserving `id` ascending order within each. Depends on T013 (FR-004, FR-005, FR-013)
- [X] T031 [P] [US2] Build the priority group component in `src/components/PriorityGroup.tsx`: section header, count badge, and the group's ticket rows. Depends on T026 (FR-005)
- [X] T032 [US2] Rewire `src/app/page.tsx` to render three `PriorityGroup` sections from `groupByPriority()` instead of a flat list. Depends on T027, T030, T031 (FR-004)

**Checkpoint**: The dashboard now groups and counts — User Stories 1 and 2 both work

---

## Phase 5: User Story 3 - Triage a ticket by setting priority and owner (Priority: P3)

**Goal**: Change a ticket's priority and owner from the dashboard, see it move group with corrected counts, and have the decision survive a reload.

**Independent Test**: Change one ticket's priority and owner, confirm it appears under its new group with updated badges, reload, and confirm the change persisted.

### Tests for User Story 3

- [X] T033 [P] [US3] Contract test for `PATCH /api/tickets/:id` happy path in `tests/contract/tickets-patch-success.test.ts`: valid priority and/or owner returns 200 with the updated ticket and persists. Depends on T020 (FR-006, FR-007)
- [X] T034 [P] [US3] Contract test for `PATCH` rejections in `tests/contract/tickets-patch-rejects.test.ts` — one case per error code: `invalid_priority`, `invalid_owner`, `unsupported_field`, `empty_update` (400), `ticket_not_found` (404), `ticket_not_open` (409). Each asserts the stored row is byte-identical afterwards. Depends on T020 (FR-008, SC-007, spec User Story 3 scenarios 3–4)
- [X] T035 [P] [US3] Integration test in `tests/integration/triage-flow.test.ts`: retagging a P2 ticket to P0 moves it between groups, increments the P0 badge, decrements the P2 badge, and survives a re-read. Depends on T020 (FR-007, SC-003)
- [X] T036 [P] [US3] Component test in `tests/component/ticket-editor.test.tsx`: render `TicketEditor` and assert the priority control offers exactly P0, P1, P2 and the owner control exactly the known owner names; assert neither renders a free-text input and neither accepts a typed value. Proves FR-014 rather than deferring it to manual checking. Depends on T006 (FR-014)

### Implementation for User Story 3

- [X] T037 [US3] Implement `PATCH /api/tickets/:id` in `src/app/api/tickets/[id]/route.ts`, wrapped in `withLogging`: validate via `ticketUpdateSchema` before any write, check owner membership, return the contract's status and error codes, and guarantee no partial write on rejection. Depends on T014, T015, T019 (FR-008, FR-009)
- [X] T038 [P] [US3] Build the ticket editor in `src/components/TicketEditor.tsx` as a client component — priority and owner both closed-choice controls with no free-text entry, owner options sourced from `listOwnerNames()`. On change, `PATCH`es the endpoint and calls `router.refresh()`. Depends on T019 (FR-014, research.md R3)
- [X] T039 [US3] Wire `TicketEditor` into `src/components/TicketRow.tsx` and pass the owner list down from `src/app/page.tsx`. Depends on T032, T038 (FR-006)

**Checkpoint**: All three user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T040 [P] Add the data-store failure state in `src/app/error.tsx` — an explicit failure message, never an empty list that would read as "no open work" (spec Edge Cases)
- [X] T041 [P] Add an empty state to `src/app/page.tsx` for a seed set with no open tickets: all three groups still render with badges of `0` (spec Edge Cases)
- [X] T042 [P] Integration-test logging in `tests/integration/logging.test.ts`: exactly one log line per request — never zero, never two — with `reason` present on failures and absent on successes (FR-010, NFR-7)
- [X] T043 [P] Write `README.md` with the setup sequence from quickstart.md, plus the FR-015/FR-016 consequence: editing `data/seed.json` to add an owner has no effect on an already-seeded machine without `db:reset`, which discards triage (A-004, research.md R5)
- [X] T044 Run the full quickstart.md validation, scenarios S1 through S9, against a fresh local setup
- [X] T045 Verify the performance budgets manually per quickstart S9: initial render under 1.5s, read and update `durationMs` p95 under 150ms (NFR-1, NFR-2)
- [X] T046 Confirm the CI pipeline passes end-to-end in under 3 minutes on a real pull request, with the commit-compliance job green (FR-011, NFR-3, NFR-6)
  - **DONE**: verified on pull request #1. Both jobs green — `verify` in 1m 33s and `commits` in 31s — running in parallel for a 1m 37s end-to-end run, well inside the 3-minute budget. Commits are signed with an SSH key registered on GitHub, so the signature check passes. Full write-up in `challenge deliverables/shadheera-nanayakkara-month1-ci-report.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **User Stories (Phases 3–5)**: All depend on Foundational. Can then run in parallel if staffed, or sequentially P1 → P2 → P3
- **Polish (Phase 6)**: Depends on the user stories being delivered

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. No dependency on other stories.
- **US2 (P2)**: Depends only on Foundational for its logic and tests. T032 edits `src/app/page.tsx`, which US1 creates — so if both are in flight, sequence T032 after T027 or expect a merge on that one file.
- **US3 (P3)**: Depends only on Foundational for the API half. T039 touches `TicketRow.tsx` (US1) and `page.tsx` (US2), so it lands last if stories run concurrently.

The API work in US3 (T033–T035 and T037) is genuinely independent of US1 and US2 and can be built and contract-tested with no UI present at all. The component test T036 is not part of that slice — it renders `TicketEditor`, so it pairs with T038.

### Within Each User Story

- Tests are written first and must fail before the implementation task that satisfies them
- Domain logic before components; components before page wiring
- Story complete and demoable before moving to the next priority

### Parallel Opportunities

- **Phase 1**: T003–T009 all parallel after T001/T002
- **Phase 2**: T012, T013, T014 parallel; T016 parallel with them; T020, T021 parallel
- **Phase 3**: T023, T024 parallel; T026 parallel with T025
- **Phase 4**: T028, T029 parallel; T030, T031 parallel
- **Phase 5**: T033–T036 all parallel; T038 parallel with T037
- **Phase 6**: T040–T043 all parallel

---

## Parallel Example: User Story 3

```bash
# Launch all four test tasks together:
Task: "Contract test for PATCH happy path in tests/contract/tickets-patch-success.test.ts"
Task: "Contract test for PATCH rejections in tests/contract/tickets-patch-rejects.test.ts"
Task: "Integration test for triage flow in tests/integration/triage-flow.test.ts"
Task: "Component test for closed-choice controls in tests/component/ticket-editor.test.tsx"

# Then the endpoint and the editor, which touch different files:
Task: "Implement PATCH /api/tickets/:id in src/app/api/tickets/[id]/route.ts"
Task: "Build TicketEditor in src/components/TicketEditor.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup (T001–T009)
2. Phase 2: Foundational (T010–T022) — critical, blocks everything
3. Phase 3: User Story 1 (T023–T027)
4. **STOP and VALIDATE**: run quickstart S1 — only open tickets listed, each with title, priority, owner
5. Demoable: this alone replaces the three-source reconciliation (G-1)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate with quickstart S1 → **MVP**
3. US2 → validate with S2 and S3 → the "how many P0s" pain is fixed (G-2)
4. US3 → validate with S4, S5, S6 → triage decisions persist (G-3)
5. Polish → S7, S8, S9 and the CI gate

### Parallel Team Strategy

After Foundational completes:

- Developer A: US1 (dashboard read path)
- Developer B: US3's API half (T033–T035, T037) — no UI dependency
- Developer C: US2's grouping logic and tests (T028–T031)

Reserve the three page-wiring tasks (T027, T032, T039) for a single sequence at the
end, since all three edit `src/app/page.tsx`.

---

## Notes

- Foundational is deliberately heavy here. The seed pipeline is a validation boundary in its own right (FR-012), not just fixture loading, so it carries real tests before any story starts.
- T017 and T018 are where FR-016's "seed only when empty" lives. Getting this wrong silently destroys triage on a routine setup re-run — the failure A-004 exists to prevent. Note the ordering: the seed file is validated *before* the empty-store check, so a malformed file fails on every run rather than slipping through once the store is populated.
- T034 tests states the UI cannot produce (FR-014 makes both controls closed-choice). They stay tested because the endpoint is independently reachable — that is the whole point of Principle II. T036 covers the other half: that the controls really are closed-choice.
- T009 scopes commit verification to the pull request's own commit range. Signature checking uses the GitHub API rather than `git verify-commit`, because a CI runner has no trusted public keys in its keyring and would report every commit as unverified.
- Commit after each task or logical group; every commit signed and Conventional Commits compliant (NFR-6).
- Stop at any checkpoint to validate a story independently.
