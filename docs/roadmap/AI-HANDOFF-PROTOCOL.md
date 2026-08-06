# AI Handoff Protocol

A reusable protocol for any AI session (Claude Code or otherwise) picking up
work on Life File, whether preparing an implementation prompt or reviewing
one that already ran.

## Required reading order

1. [CURRENT-STATUS.md](CURRENT-STATUS.md)
2. [ENGINEERING-RULES.md](ENGINEERING-RULES.md)
3. [ANNUAL-SIMULATION-PIPELINE.md](ANNUAL-SIMULATION-PIPELINE.md)
4. The page for the active development phase (currently
   [Phase 4C](PHASE-4C-BUSINESSES-AND-EMPLOYMENT.md))
5. The relevant source files and tests for whatever you are about to touch —
   read them directly; do not trust a roadmap page's API description over
   the actual code.

## Before preparing an implementation prompt

Run, and use the actual output rather than what any earlier conversation or
this page claims:

```
git fetch origin
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
git status --short
git log --oneline --decorate -15
git diff --stat origin/master...HEAD
```

If the branch head or `origin/master` SHA differs from what
[CURRENT-STATUS.md](CURRENT-STATUS.md) records, treat that page as stale and
update it (see [Roadmap Maintenance](ROADMAP-MAINTENANCE.md)) rather than
proceeding on outdated assumptions.

## After an implementation is reported complete

The reviewing session must, before marking anything reviewed or updating
roadmap status:

1. fetch the commit from GitHub (`git fetch origin`) and confirm it exists;
2. confirm it was actually pushed to the expected branch, not only
   committed locally;
3. compare it against the previously reviewed commit
   (`git diff --stat <previous>...<new>`);
4. inspect every changed file's diff directly;
5. inspect the focused test file(s) for the changed system(s);
6. inspect annual ordering — does the change run at the correct point in
   [the pipeline](ANNUAL-SIMULATION-PIPELINE.md)?
7. inspect migration behavior against
   [the stable-identity rules](ENGINEERING-RULES.md#stable-identity);
8. inspect invariant completeness for every new/changed field;
9. inspect deterministic-stream usage — any `Math.random`/shared `Random`/
   `chance()` inside replayable annual code is a defect;
10. inspect duplicate-payment or duplicate-progression risk (two paths both
    mutating the same authoritative fact);
11. consolidate related review findings into one follow-up implementation
    prompt rather than several overlapping ones;
12. avoid re-requesting a prompt that a previous commit already
    implemented — check the branch's commit history first;
13. only mark a status update (MERGED, IMPLEMENTED ON BRANCH, etc.) after
    steps 1–10 above, never from an AI's self-report alone.

## Implementation prompt requirements

Every implementation prompt handed to an implementing AI/session should
state:

- the required branch to work on;
- the required starting commit (verified `HEAD` from the commands above);
- exactly which files may be touched;
- explicit in-scope behavior;
- explicit out-of-scope behavior (what **not** to build in this pass);
- the state schema being added/changed;
- the public API being added/changed;
- required migration behavior;
- required deterministic behavior;
- where in the annual pipeline the change runs;
- required invariants;
- required focused test coverage;
- the full test command(s) to run before reporting done;
- the diagnostic command(s) to run before reporting done;
- the exact commit message to use;
- whether to push, and to which branch;
- the exact report format expected back (e.g. "report only: commit SHA,
  test counts, diagnostic results, changed files, confirmation of a clean
  working tree" — matching the pattern already used successfully for the
  Phase 4C-2/4C-3 prompts).

## Status definitions

Use exactly these six statuses, consistently, across every roadmap page:

- **MERGED** — present in `origin/master`.
- **IMPLEMENTED ON BRANCH** — pushed to a development branch, verified by
  reading the actual diff, not yet merged.
- **IN PROGRESS** — actively being implemented in the current session, not
  yet pushed/verified.
- **PLANNED** — designed on a roadmap page, no code exists yet.
- **DEFERRED** — was planned for a nearer phase, explicitly pushed later by
  a documented decision (see
  [Roadmap Maintenance](ROADMAP-MAINTENANCE.md#when-plans-change)).
- **BLOCKED** — cannot proceed until a named dependency (another phase/
  slice/refactor) lands.

A feature is **MERGED only when it exists in `origin/master`.** A pushed
development-branch implementation, however complete, is IMPLEMENTED ON
BRANCH, never MERGED, until it is actually on `master`.

## Workflow restrictions

- No optional git worktree operations beyond what an explicit task requires.
- No optional branch cleanup.
- No pruning or metadata cleanup unless explicitly requested.
- No repeating an implementation prompt for work a commit already covers —
  check history first.
- No unnecessary manual gameplay testing when the automated test suite and
  diagnostics already cover the change.
- No accepting "tests passed" as sufficient without the code review steps
  above — passing tests are necessary, not sufficient (see
  [Current Status — Known review rules](CURRENT-STATUS.md#known-review-rules)).
- No marking a branch-only feature MERGED.
