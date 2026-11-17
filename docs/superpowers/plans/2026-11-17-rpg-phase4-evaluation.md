# RPG Phase 4 — Agency and Playtest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans with test-first steps. Checklist below.

**Goal:** Fix forced-roll openings, add privacy-preserving formative player evaluation and a deterministic story/odds audit without modifying map work.

**Architecture:** Small additive read-only `RPGPlaytest` helper and UI, plus five authored options and development-only audit CLI. Existing `StorySystem`, `RPG`, energy, world simulation and persistent archive remain authoritative.

**Tech Stack:** Browser vanilla JS, node:test, VM loader, Chrome CDP.

**Spec:** `docs/superpowers/specs/2026-11-17-rpg-phase4-evaluation.md`

## Global constraints
- Base exact e756a50e285183a8062c98f49e8284087101446e. No map-state or geography code changes.
- Zero new persistent player fields, no silent telemetry, no arbitrary TN or merit tweaks.
- Tests must visibly fail before each production change; full suite and diagnostics green before merge.
- Explicit user authorization: merge automatically after verification, no extra approval.

## Review focus
1. Low-asset characters must always have a no-risk way out of eligible opening scenes.
2. All original option indices, failGoto targets, existing endings and scenes must remain valid.
3. Repeated UI visits/rating changes must not mutate or persist World state or character data.
4. Report must not leak player/NPC names, seed, raw story text or identifiers; missing historical check counts distinguished from actual zero.
5. Clipboard API failure must not falsely report success; mobile and reduced-motion layout must remain usable.

### Task 1 — Preserve agency in all authored quest openings
Files: `js/systems/story-quests.js`, `tests/rpg-playtest.test.js`
- [ ] Add failing VM tests for all 12 initial quests (real cast/fixtures), five new guaranteed options, low-assets fallback, and preserved original first choices.
- [ ] Confirm RED, add minimum five no-roll options linked to existing safe endings.
- [ ] Run focused and complete suite, commit.

### Task 2 — Read-only experience-report model
Files: `js/systems/rpg-playtest.js`, `tests/rpg-playtest.test.js`, `life-game.html`
- [ ] Write RED tests for numeric summary derived from canonical archive, missing vs zero check count, score validation, output sanitization, no saved mutation or network calls.
- [ ] Implement pure audit/summarize and transient 3-item feedback state, export only aggregated anonymous values.
- [ ] Verify GREEN + full suite and commit.

### Task 3 — Optional compact Playtest view in Stories
Files: `js/ui/story-quest-ui.js`, `css/story-rpg.css`, `life-game.html`, `tests/rpg-playtest.test.js`
- [ ] Write RED UI click/rating/report tests, including copy failure and no life-data side effects.
- [ ] Add Playtest toggle and responsive, touch-friendly 1–5 controls, explicit copy feedback and no persistent storage.
- [ ] Verify GREEN + full suite and commit.

### Task 4 — Deterministic catalogue audit and measured playtest protocol
Files: `tools/rpg-playtest-audit.js`, `tests/rpg-playtest.test.js`, `package.json`, `docs/superpowers/reviews/2026-11-17-phase4-evidence.md`
- [ ] Write RED CLI tests for exact odds, 12/12 no-roll openings and zero invalid branch links, deterministic JSON on repeat invocation.
- [ ] Implement read-only CLI fixture and scene/odds checks. Export inspectable machine-readable results.
- [ ] Run full tests, diagnostics and real browser widths 320/390/768/1440.
- [ ] Check protected paths 0 and clean diff; record observed metrics and human playtest protocol.
- [ ] Commit, push, create PR, merge to master per user standing instruction, rerun full suite against exact merged SHA.
