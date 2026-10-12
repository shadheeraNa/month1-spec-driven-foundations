# CI Report — Month 1

**Repository:** https://github.com/shadheeraNa/month1-spec-driven-foundations
**Pull request:** [#1](https://github.com/shadheeraNa/month1-spec-driven-foundations/pull/1)
**Workflow file:** `.github/workflows/ci.yml`

---

## Pipeline Setup

The pipeline runs on GitHub Actions on an Ubuntu machine. Every run starts on a
brand-new machine, so nothing is left over from the run before.

### Triggers — when it runs

| Event | What it means |
|---|---|
| `pull_request` into `main` | A pull request is opened or updated |
| `push` to `main` | Code lands on the main branch |

### Jobs — what it runs

Two jobs, on separate machines, at the same time:

| Job | What it checks | Runs on |
|---|---|---|
| `verify` | lint → type check → tests → build | every trigger |
| `commits` | commit messages follow Conventional Commits, and every commit is signed | pull requests only |

`commits` is limited to pull requests because it reads the pull request's own
commit list from the GitHub API. On a plain push there is no pull request to
read, so the job is skipped.

### Caching strategy

| What is cached | How |
|---|---|
| npm dependencies | `cache: npm` in `actions/setup-node` |
| Next.js build output | `actions/cache` on `.next/cache` |

Caching matters because the machine is wiped between runs. Without it, every run
re-downloads every dependency from scratch.

---

## Results Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| End-to-end duration | < 3 min | **1m 37s** |
| Lint errors | 0 | **0** |
| Type errors | 0 | **0** |
| Test pass rate | 100% | **100% (102 of 102)** |

### All runs

| Run | Trigger | `verify` | `commits` | Total |
|---|---|---|---|---|
| #1 | Push to `main` | 1m 6s | skipped | 1m 9s |
| #2 | Pull request #1 opened | 1m 36s | 35s | ~1m 36s |
| #3 | Re-run of #2 | 1m 33s | 31s | 1m 37s |

The two jobs run at the same time on separate machines, so the total is roughly
the **longer** of the two, not the sum.

---

## Failures and Fixes

**No pipeline run failed.** All three runs finished green. Three things were
still found and dealt with, recorded honestly below.

### 1. Node.js 20 deprecation warning

**Error (run #1):**
> Node.js 20 is deprecated. The following actions target Node.js 20 but are being
> forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4

**Root cause:** `actions/checkout@v4` and `actions/setup-node@v4` declare the
Node 20 runtime, which GitHub is retiring. This is about the Node version the
*actions themselves* run on — not the Node 20 the app is built with.

**Fix:** commit `5c88cf6` — pinned `checkout`, `setup-node` and `cache` to `v5`,
the first major version of each that targets Node 24.

**Result:** warning gone in run #2. The only annotation left is an unrelated
GitHub notice about the `ubuntu-latest` image being updated.

### 2. The commit-compliance job had never run

**Problem:** the `commits` job showed as *skipped* on every run. Task T046 in
`tasks.md` recorded this as unverified, and it was the last unchecked task in
the project.

**Root cause:** two things. The job only fires on pull requests, and no pull
request had ever been opened. Separately, commits were unsigned, so the job
would have failed if it had run.

**Fix:** set up SSH commit signing (an ed25519 key registered on GitHub as a
*Signing Key*), then opened pull request #1.

**Result:** the job ran for the first time and passed in 35s. Commit `5c88cf6`
shows as **Verified** on GitHub. T046 is now satisfied.

### 3. Next.js build cache — measured, kept despite a negative result

**What was measured (run #3):** the cache hit and restored correctly — 4 MB,
confirmed in the logs. But `npm run build` took **18s with the cache, and 18s in
run #1 with no cache at all**. Restoring cost 12s and saving cost 9s.

**Root cause:** `.next/cache` speeds up *recompiling*. This app has 3 routes and
a few components, so `next build` has very little to recompile — most of the 18s
is Next.js starting up, type checking, and collecting page data, which a cache
cannot skip.

**Decision: kept.** The pipeline requirement asks for Next build caching, there
is 83 seconds of headroom against the 3-minute budget, and the trade-off turns
positive as the app grows.
