# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository.

## Before planning or modifying code

1. Read [`docs/roadmap/CURRENT-STATUS.md`](docs/roadmap/CURRENT-STATUS.md).
2. Read [`docs/roadmap/ENGINEERING-RULES.md`](docs/roadmap/ENGINEERING-RULES.md).
3. Read [`docs/roadmap/ANNUAL-SIMULATION-PIPELINE.md`](docs/roadmap/ANNUAL-SIMULATION-PIPELINE.md).
4. Read the page for the active development phase — currently
   [`docs/roadmap/PHASE-4C-BUSINESSES-AND-EMPLOYMENT.md`](docs/roadmap/PHASE-4C-BUSINESSES-AND-EMPLOYMENT.md).
5. Verify `origin/master`, the active branch, `HEAD`, and working-tree
   status with `git fetch origin && git status --short && git rev-parse
   HEAD origin/master`.
6. Inspect the actual current code and tests before preparing or running an
   implementation prompt — do not trust a roadmap page's API description
   over the source.

## Rules

7. Do not assume roadmap status is current without the Git verification in
   step 5 — it is a snapshot and can go stale.
8. Do not repeat an implementation prompt for work a commit already covers
   — check branch history first.
9. Do not request optional worktree operations, branch cleanup, pruning,
   metadata cleanup, or manual gameplay testing unless explicitly asked.
10. Group related implementation blockers into one prompt rather than many
    overlapping ones.
11. Claude CLI implements; review sessions inspect commits and prepare the
    next implementation prompt — see
    [`docs/roadmap/AI-HANDOFF-PROTOCOL.md`](docs/roadmap/AI-HANDOFF-PROTOCOL.md).
12. Persistent systems require migration, deterministic behavior,
    invariants, focused tests, full tests, and diagnostics — see
    [Engineering Rules](docs/roadmap/ENGINEERING-RULES.md).
13. Do not silently create a second authoritative state model for a fact
    that already has one — see
    [Persistent authority](docs/roadmap/ENGINEERING-RULES.md#persistent-authority).
14. Do not use `Math.random` or the shared global `Random` inside
    replayable annual simulation systems — use
    `WorldSimulation.streamFor(world, year, entityId, subsystem)`.
15. Do not mark work MERGED until it is present in `origin/master` — see
    [Status definitions](docs/roadmap/AI-HANDOFF-PROTOCOL.md#status-definitions).

## Canonical roadmap

- [ROADMAP.md](ROADMAP.md) — repository-level entry point
- [docs/roadmap/README.md](docs/roadmap/README.md) — full roadmap index
- [docs/roadmap/CURRENT-STATUS.md](docs/roadmap/CURRENT-STATUS.md) — live status
- GitHub Wiki: https://github.com/rumiazhari/life-game/wiki

## Quick reference

- Test: `npm test` (all), `node --test tests/<file>.test.js` (one file)
- Diagnostics: `npm run diagnostic:world`, `npm run diagnostic:npcs`
- Syntax check a changed file: `node --check <file>.js`
- No build step, no bundler, no framework — plain scripts loaded directly
  by `life-game.html`; see
  [Repository Architecture](docs/roadmap/REPOSITORY-ARCHITECTURE.md).
