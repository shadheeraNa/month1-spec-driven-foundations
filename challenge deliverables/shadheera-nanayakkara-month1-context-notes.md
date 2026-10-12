# Context Engineering Journal — Month 1

**Author:** Shadheera Nanayakkara · BISTEC Global
**Project:** Ticket Triage Dashboard (Month 1 Challenge)
**Covers:** two build attempts — an early ad hoc pass done by direct Claude Code
prompting, then a full restart using the formal GitHub Spec Kit pipeline
(constitution → specify → clarify → plan → tasks → analyze → implement) in
`C:\dev\ticket-triage-speckit`. The Spec Kit attempt is the one submitted;
the ad hoc pass is referenced only where it produced genuinely different,
useful evidence.

Everything below was captured live while the work happened, not
reconstructed afterward. Nothing here was staged or manufactured to satisfy
a grading criterion — several sections say plainly when a criterion showed
up naturally versus when it didn't apply cleanly to a spec-first workflow.

---

## Prompt Strategy

The two attempts used context very differently, and that difference is
itself worth recording.

**Ad hoc pass (early attempt, direct prompting).** There were no
`@`-attachments. Claude Code can open any file in the repo on its own, so
"context" was actually controlled by two things: what the prompt named
explicitly (for example, "read `docs/spec/prd.md`" or "per S-001"), and
`/clear` between tasks so earlier discussion didn't leak into the next one.
Every prompt named the exact spec file(s) the task needed and nothing more.

**Spec Kit pass (submitted attempt).** Context here is mostly set by the
pipeline's own conventions rather than by manually attaching files to each
command:

| Stage | What it was pointed at | Why that and not more |
|---|---|---|
| `/speckit-constitution` | Spec Kit's own template + interactive answers | No project file exists yet to read |
| `/speckit-specify` | `prd.md` only, with the instruction "Read prd.md in this repo and use it as the source of truth" | `prd.md` already contains the persona, FRs, NFRs, and both ADRs the spec needs to derive from. Pointing at more (e.g. the whole `Month 1 Challenge.pdf`) would have let challenge-rubric language leak into the spec instead of Bistec's actual PRD language |
| `/speckit-clarify` | `spec.md` only (by convention — the command's whole job is to interrogate that one document) | Clarify is a gap-finding pass over what specify already produced; adding other files would dilute a targeted ambiguity scan |
| `/speckit-plan` | `spec.md` + the ADRs already embedded in `prd.md`, read automatically | Plan's job is to turn the *feature* spec into a technical design; it doesn't need the challenge brief again, only the two documents that constrain it |
| `/speckit-tasks` | `plan.md` + `spec.md` | Tasks are derived from the plan's structure, checked back against the spec's requirement IDs for coverage |
| `/speckit-analyze` | `spec.md` + `plan.md` + `tasks.md` together, and deliberately nothing else (no source code, since none existed yet) | This stage's entire purpose is cross-artifact consistency — it needs all three at once or it can't compare them |
| `/speckit-implement` | `spec.md` + `plan.md` + `tasks.md`, generating the full `src/` tree from them | By this stage the three artifacts are the complete, clarified spec; reading anything else risked implementing against stale intent |

The honest difference: in the ad hoc pass, *I* chose what context each
prompt carried. In the Spec Kit pass, the pipeline's stage boundaries chose
it, and my role shifted to deciding what to *answer* at each checkpoint
(clarify questions, analyze remediation scope) rather than what files to
hand over.

---

## Failure Modes

Most of the genuine failures in this build happened before any code
existed, which is the point of a spec-first pipeline — but it means a few
of these are "wrong requirement decision" rather than "wrong code."
Where that's the case, it's labelled honestly rather than stretched to fit.

**1. Wrong first-pass advice on seed-priority validation (spec stage, not code).**
During `/speckit-clarify` Q1, the spec contained a real contradiction:
FR-004 said exactly three priority groups render, while an edge case (added
by specify's own self-correction) said an unrecognised priority must be
"surfaced." My first-pass advice was to add a fourth "Untriaged" UI group.
That was wrong: it treated a setup-time data problem as a runtime UI
problem. Missing context was that there are only two ways a priority value
can ever enter the system — the one-time seed load and the PATCH endpoint
(already validated) — so a malformed priority can only exist if the seed
script itself never checked it. The fix added was seed-load-time
validation, not new UI (`spec.md`, FR-012, line 203).

**2. Wrong first-pass advice on the owner list's source (spec stage, not code).**
During Q4, I recommended hardcoding the owner list as a code constant, for
consistency with how priority is a fixed enum. That reasoning missed that
priority is a business rule that rarely changes, while owner is personnel
data that changes independently of the tool's logic. The user's own
reasoning was sharper and the fix went the other way — an explicit owner
list declared in the seed file (`spec.md`, FR-015, line 220).

**3. Task-numbering error in generated output, self-corrected (Claude Code, real output).**
During the post-`/speckit-analyze` remediation, Claude Code's first draft
labelled a new component test `T035`. That was wrong: an earlier insertion
(a new commit-compliance CI task at `T009`) shifts every task number below
it by one, so the correct id was `T036`. The agent caught its own error
before I reviewed the diff: *"In the E1 hunk I labelled the component test
T035, but that ignored D1's own insertion at T009 shifting everything below
it... the component test is T036, not the T035 in my first draft."* Fixed
in `tasks.md` line 121 and `research.md` line 216. This is the one failure
mode in this project that is unambiguously "the agent produced wrong output
in a real artifact," not a requirements discussion.

**4. Two test-authoring bugs, self-caught during implement (real code).**
Both were bugs in the agent's own generated *tests*, not in the product:
- Testing Library's automatic cleanup depends on Vitest's global `afterEach`,
  which this project doesn't enable, so component renders accumulated
  across tests instead of being torn down. Fixed with an explicit
  `afterEach(() => { cleanup(); vi.restoreAllMocks(); })`.
- A test asserted that assigning an invalid value to a `<select>` would
  leave its previous value in place. Per the HTML living standard, an
  unmatched value deselects entirely (`selectedIndex` becomes `-1`). The
  component was already correct; the test's expectation was wrong, and the
  assertion was corrected to check `selectedIndex === -1` instead.

**5. A precedence bug caught before any code was written (near-miss, spec stage).**
`/speckit-analyze` found that the task plan implemented "skip seeding if the
store is non-empty" *before* "validate the seed file's shape," meaning a
malformed seed file with an empty owner list would pass silently on an
already-seeded machine. Fixed by reordering validation ahead of the
empty-store check (`spec.md`, FR-016, line 230) before implement ever ran,
so this bug never reached actual code.

---

## Re-Prompt Examples

Four pairs, three required plus the mandatory "less context" case. Each
quotes the actual wrong output and names the file the correction landed in.

**Pair 1 — seed-priority validation (Q1).**
*Before (my exact wrong recommendation):* "leaned toward A ('cheap
insurance'), B/D both risk hiding a possible P0" — recommending a fourth
"Untriaged" UI group.
*Re-prompt (user's actual follow-up question):* "so can there be tickets in
the seed file [with a priority] that isn't P0, P1, or P2 — or has no
priority at all? ... how tickets get lost and how there will be tickets
with no priority at all?"
*After:* validate at seed load, reject bad rows before they become tickets.
*Landed in:* `specs/001-ticket-triage-dashboard/spec.md`, FR-012, line 203.
*Why this context won:* the re-prompt forced tracing the only two entry
points a priority value has, which the first answer never checked.

**Pair 2 — owner list source (Q4).**
*Before (my exact wrong recommendation):* "first leaned toward D, for
consistency with how priority is already handled as a fixed, code-level
enum."
*Re-prompt (user's counter-reasoning):* "we only have three ticket
priorities is a decision that holds — but people come and go so they can
change. If we have to go for a code change every time then it is
problematic."
*After:* Option B, an explicit owner list in the seed file.
*Landed in:* `specs/001-ticket-triage-dashboard/spec.md`, FR-015, line 220,
and D-003, line 334.
*Why this context won:* the re-prompt separated business-rule data
(rarely changes) from personnel data (changes independently), a
distinction the first answer collapsed.

**Pair 3 — task-numbering self-correction (post-analyze remediation).**
*Before (Claude Code's exact wrong output, from its own draft):* "In the E1
hunk I labelled the component test T035."
*Re-prompt:* none from a human — the agent re-derived the numbering itself
against its own insertion table and caught the conflict before the diff was
reviewed.
*After (exact corrected output):* "that ignored D1's own insertion at T009
shifting everything below it... the component test is T036, not the T035 in
my first draft."
*Landed in:* `specs/001-ticket-triage-dashboard/tasks.md`, line 121, and
`research.md`, line 216.
*Why this matters:* it's evidence the agent's own verification (an
exhaustive scan of every `T0xx` token in the file, not a visual pass) caught
an error that would otherwise have shipped a self-contradictory task list.

**Pair 4 — in-group ticket ordering (Q2), the "less context" case.**
*Before (the tool's own recommended option, needing more context):* Option
A, "oldest-first by creation date," which requires adding a `createdAt`
field that exists nowhere in `prd.md` or the challenge brief.
*Re-prompt (narrowing the requirement instead of adding a field):* pointed
out that Option C, "ID ascending," achieves the same "oldest first" outcome
with zero new fields, if seed ticket IDs are simply authored in arrival
order — directly contradicting the tool's own claim that ID order "carries
no meaning."
*After:* Option C, chosen, with the convention (ID order = arrival order)
written down explicitly rather than left implicit.
*Landed in:* `specs/001-ticket-triage-dashboard/spec.md`, FR-013, line 210,
and A-007, line 324.
*Why less context won:* the richer option (a new timestamp field, new
sorting logic) solved a problem that a narrower option already solved for
free. Adding the field would have been unused complexity carried into every
later stage — plan, tasks, and implement — for no behavioural gain.

---

## A genuine "less scope, not just less context" moment (Q5)

Worth recording alongside Pair 4, though it's scope rather than file
context: during Q5, I initially proposed splitting owner-list refresh from
ticket seeding and adding graceful handling for a since-removed owner. The
user asked, correctly, whether the challenge brief or the PRD actually
expected a changing user roster at all — it doesn't. Both refinements were
dropped before ever reaching a task list, and the tradeoff was written down
as an accepted consequence (`spec.md`, A-004) instead of quietly built. This
is the same discipline as Pair 4, applied to scope rather than to a single
field.

---

## Measurable Improvements

| Stage | Before | After |
|---|---|---|
| specify | Checklist failed 2 gates (implementation detail leaking into requirements, weak scope bounding); edge cases thin | All checklist gates pass; edge cases expanded from 2 to 8 |
| clarify | 1 internal contradiction (FR-004 vs. an edge case); 2 assumptions that didn't match actual intent | Contradiction closed; both assumptions corrected before any planning happened |
| clarify (scope) | 2 speculative refinements drafted for an unrequested "changing roster" scenario | Both declined after checking against `prd.md` and the challenge brief; documented as an accepted tradeoff instead of built |
| analyze | 1 CRITICAL constitution gap (commit-compliance check unenforced); existing commit history already non-compliant with a naive full-history check | PR-scoped check designed before the CI gate was added, avoiding a doomed pipeline |
| analyze | 1 undefined precedence bug (validate vs. empty-check order) that would silently pass bad data on a re-seeded machine | Fixed pre-implementation, before it could ever manifest as running code |
| implement | FR-014 (closed-choice controls) had zero automated coverage | Proven three independent ways: a component test, a runtime HTML check (0 free-text inputs / 92 selects across 46 tickets), and direct code reading — each verified against source, not just the completion report |
| implement | 2 test-authoring bugs, 1 environment-compatibility risk (a Prisma command gated behind an interactive consent prompt) | All 3 caught and fixed by the agent itself during implement, each with an in-repo comment explaining why |

---

## Honest gaps

Two things this journal does not claim: the ad hoc pass never produced a
natural "wrong code the user had to correct" pair — every task in it was
first-try correct, so its failure-mode material is limited to one stale
warning and one correctly-flagged routing collision, not a re-prompt pair.
And this submission's re-prompt pairs are weighted toward the specify/
clarify stages, where the "agent" being corrected was the assistant coaching
the Spec Kit answers, not Claude Code generating source. Only Pair 3 (task
numbering) and the two implement-stage test bugs involve Claude Code's own
generated artifacts directly. That's a genuine property of a spec-first
workflow — most of the actual back-and-forth happens before code exists —
not a shortfall in how the evidence was gathered.
