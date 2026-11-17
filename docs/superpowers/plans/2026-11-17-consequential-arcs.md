# Phase 3 Consequential Arc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for test-first implementation. Checklist steps below.

**Goal:** Four cross-linked career/underworld RPG chapters with one-year echoes and canonical consequences.

**Architecture:** Add declarative `StoryEpisodes` from a single module. Read prior archive and authoritative employment data, not new world fields. Extend existing chapter energy/file guards minimally.

**Tech Stack:** Plain browser JavaScript, Node built-in tests/VM loader, AEROMI headless Chrome.

**Spec:** `docs/superpowers/specs/2026-11-17-consequential-arc-design.md`

## Global Constraints
- Base exact `632b16479a43d4aa581ff3e7cc1674a1b6e359ae`, no map edits, no new persistent authority or dependency.
- Use existing 3d6 engine and native `StorySystem`; specific `jobRaise` must bind to original contract.
- New quests cost one existing annual energy. Existing 8 quests retain their current costs.
- No automatic claim of human-tested enjoyment. Test everything before merge/push.

## Review Focus
1. No employer/no coworker: no references to nonexistent NPC; career quest unavailable without contract.
2. Switch employers or rehire same business mid-episode: old raise cannot follow the new contract.
3. No Ward record or evidence: reporting still has valid check and fail-forward route, and never invents evidence.
4. Save/reload and repeated file operations: 3d6, money and merit are not awarded twice.
5. Low energy/custody: no failed start mutates counter or ledger; next-year followups do not appear early.

---

### Task 1 — Career and underworld canonical episode catalogue
**Files:** Create `js/systems/story-consequence-arcs.js`, `tests/story-consequence-arcs.test.js`; modify `life-game.html`.

- [ ] Write failing tests: four IDs registered exactly once; gating from canonical archive; real contract/coworker; earlier wage/family and Ward/market outcomes change story lines and odds; all option goto/failGoto references exist.
- [ ] Run focused tests and record red assertions.
- [ ] Implement two two-chapter episode chains with 3d6 and safe guarantee alternatives; no second save store.
- [ ] Run focused and full tests; commit `feat(story): add interconnected career and underworld chapters`.

### Task 2 — Persistent outcomes, safe references and one-shot filing
**Files:** Extend `tests/story-consequence-arcs.test.js`; adjust `js/systems/story-consequence-arcs.js` and `js/systems/story-quest-engine.js` where tests require.

- [ ] Write failing tests: career raise only original exact contract; real coworker bond and memory; no coworker fallback; evidence/money/scrutiny distinct underworld endings; no duplicate rolls/effects or early filing; deterministic success/failure and next-year follow-up outcomes.
- [ ] Observe red tests.
- [ ] Implement all missing safety and replay checks in smallest compatible change; run focused/full tests.
- [ ] Commit `feat(story): verify persistent consequences and safe story archive lifecycle`.

### Task 3 — Existing annual energy and responsive quest cards
**Files:** Modify `js/systems/story-quest-engine.js`, `js/ui/story-quest-ui.js`, `life-game.html`, optionally `css/story-rpg.css`; extend `tests/story-consequence-arcs.test.js`.

- [ ] Write failing tests for new quest `energyCost=1`, no-energy start no mutation, successful UI start once, no dialogue cost, and prior wage/legacy costs unchanged.
- [ ] Observe red; implement generic new-episode metadata cost, read cost from eligibility list at UI start, show appropriate art and cost, keep existing annual ledger.
- [ ] Run focused and full tests; commit `feat(story): integrate cross-arc chapter energy and visual cards`.

### Task 4 — Verification and delivery
**Files:** `docs/superpowers/reviews/2026-11-17-phase3-evidence.md`.

- [ ] Run `node --check`, `npm test`, `npm run diagnostic:world`, `npm run diagnostic:npcs`.
- [ ] Run actual headless Chrome visit and 320/390/768/1440 px card/viewport checks.
- [ ] Verify `git diff --check` and protected paths changed = 0 against merged Phase 2 base.
- [ ] Commit observed evidence, publish branch, review and merge to `master` (standing user instruction to merge immediately). Rerun merged-head tests; keep local workspaces intact.
