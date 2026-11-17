# Life File RPG Phase 5 — Scenario Playtests and Reporting Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for stepwise RED→GREEN and validation.

**Goal:** Verify actual RPG playability across seed/policy/quest conditions and prepare legitimate anonymized report analysis without claiming human testing.

**Architecture:** Developer-only Node CLIs that call the existing VM game engine or process manually supplied anonymized JSON. The RPG runtime and persistent World authority remain untouched.

**Tech stack:** Node v24, `node:test`, existing `tests/helpers/vm-loader.js`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-17-phase5-scenario-playtests.md`

## Protected constraints
- Base e3cab8e7e7cc29f94b91e70b138fa29f68c733a3. No map or travel changes.
- 12 original/Phase-3 quests and 3 scripted policies, 5 independent seeds each; 180 real-engine sessions.
- Follow-ups strictly later year, idempotent once-only payout/merit.
- Synthetic reports clearly distinguished from human survey observations.

### Task 1 — End-to-end simulated playthrough engine
**Files:** `tools/rpg-scenario-playtest.js`, `tests/rpg-scenario-playtest.test.js`, `package.json`.
- [ ] Write tests that fail because simulator does not exist: 180 engine sessions, 12 chapters, policies, no failures, determinism, actual dice and merit, all five next-year follow-ups and no same-year followups.
- [ ] Run RED and inspect expected missing-script failure.
- [ ] Implement deterministic VM scenarios using real StorySystem; run all sessions/guard loops/invariant checks and produce JSON labelled automated simulation.
- [ ] Run GREEN, `npm test`, commit.

### Task 2 — Strict offline anonymized report aggregator
**Files:** `tools/rpg-playtest-aggregate.js`, `tests/rpg-playtest-aggregate.test.js`, `package.json`.
- [ ] Write failing tests using synthetic exported-report JSON fixtures: 1–5 score distribution, medians, missing ratings, overflow/bad schema/PII/unknown keys, deterministic output, explicit CLI input.
- [ ] Run RED, implement read-only parser and descriptive aggregation with no telemetry.
- [ ] Run GREEN, full tests, commit.

### Task 3 — Reproducibility and final integration
**Files:** `docs/superpowers/reviews/2026-11-17-phase5-evidence.md`, `docs/playtesting/RPG-PHASE5-INSTRUCTIONS.md`.
- [ ] Validate `npm run simulate:rpg` twice and compare SHA/bytes; run all unit tests, world/NPC diagnostics and author audit.
- [ ] Compare gameplay outcomes across policy; diagnose any real engine failures and fix through additional RED/GREEN tests.
- [ ] Prepare clear player-study handoff (real reports may be analyzed only after explicit participant collection).
- [ ] Audit `git diff --check`, protected map paths changed = 0.
- [ ] Commit, push PR, immediately merge as previously requested; rerun all tests on the exact merged SHA and report observed results.
