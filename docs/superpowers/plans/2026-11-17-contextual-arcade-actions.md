# Phase 2 Contextual Arcade Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development. Track test-first steps with checkboxes.

**Goal:** Add five integrated Work/Learn/Connect/Recover/Risk action tiles and deterministic 3d6 execution-quality outcomes to ordinary Life File gameplay.

**Architecture:** One small adapter selects real registry actions and uses canonical RPG preview/resolve. `js/ui.js` integrates the adapter at the existing priority view and immediate action execution path. Base effects/energy are unchanged, with small added `fx` and a compact receipt.

**Tech Stack:** Vanilla JavaScript, Node 24 native `node:test`, existing VM test harness and headless Chrome.

**Spec:** `docs/superpowers/specs/2026-11-17-contextual-arcade-actions-design.md`

## Global Constraints
- Baseline `master` commit `f4f619657c309afe1f88245713b9cc1a94cbf68f`; work exclusively on `feat/arcade-rpg-contextual-actions-20261117`; preserve all existing branches and map work.
- Never edit `js/map.js`, `js/state.js`, `js/systems/world-gameplay.js`, `assets/maps/**`. No new dependencies or persistent data authority.
- All mapped outcomes use canonical 3d6, unchanged difficulty thresholds and trait modifiers. Never add second roll to fallback actions.
- Preserve original action `avail`, `cost`, `apply`, `markActionDone`, `energyUsed`; new quality adjustments only.
- No automatic merge/deploy, even if tests pass.

## Review Focus
1. A zero-energy player must not roll, receive a bonus, or start a mapped action.
2. Two clicks on a used action in the same year cannot reroll or double-pay, including a zero-cost fallback.
3. Preview must use pre-action characteristics: walk's base health gain must not improve its own quality roll probability retroactively.
4. A track win/loss remains the original 50/50 result; 3d6 odds only affect its supplemental risk-handling delta.
5. A teen, jailed character, or person without employment/spouse must see eligible fallback categories, not broken buttons.

---

### Task 1 — Contextual catalog and canonical check adapter

**Files:** Create `js/systems/contextual-actions.js` and `tests/contextual-actions.test.js`. Modify `life-game.html` for script loading.

**Interfaces:** `ContextualActions.lanes(world,subject,{getAction,reserved,remainingEnergy}) -> [five lane records]`; `ContextualActions.config(type,id)`; `ContextualActions.preview(world,subject,type,id) -> RPG preview or null`; `ContextualActions.resolve(world,subject,type,id,{year,stream}) -> {check,category} or null`; `ContextualActions.bonusFor(outcome,baseFx) -> fx dictionary`; `ContextualActions.combineFx(base,extra)-> merged fx`.

- [ ] Write failing tests covering all five family candidates and fallback, eligibility and budget, background/skill/health effect on preview, deterministic injected streams success/failure, risk mitigation independent of 50/50, and no roll on unmapped fallback.
- [ ] Run `node --test tests/contextual-actions.test.js` and confirm expected red assertions.
- [ ] Implement adapter using `RPG.previewCheck`/`resolveCheck` with pre-action subject and deterministic year/action stream; preserve real action registries.
- [ ] Run focused tests, then full `npm test`; expect zero failures.
- [ ] Commit adapter/tests/script load as `feat(rpg): add canonical contextual action adapter`.

### Task 2 — One-click action integration and bounded effects

**Files:** Modify `js/ui.js` (only `performActionNow` and `renderActionReceipt`), `tests/contextual-actions.test.js` and existing UI VM fixtures if necessary.

**Interfaces:** Existing `performActionNow(type,id,extra)` remains the sole immediate action executor; added check is returned transiently as `r.arcadeCheck` and included in the existing receipt; no separate state ledger.

- [ ] Add failing end-to-end tests: normal study and walk get same energy cost and base effects plus deterministic quality delta; an already-filed action cannot award again; no-energy and unavailable actions cannot roll; result receipt contains actual three dice and check target; no overlay on unmapped native actions.
- [ ] Run focused tests; verify meaningful failure before implementation.
- [ ] Add preflight and invoke adapter resolve before base action; merge bonus after base apply and before `applyFx`; render dice/check strip in existing receipt. No second action menu.
- [ ] Run focused suite, full `npm test` and inspect legacy action receipt assertions.
- [ ] Commit as `feat(rpg): apply contextual checks through live actions`.

### Task 3 — Five visual action tiles in Priorities

**Files:** Modify `js/ui.js` (`focusSituationHtml`/priority click delegation), `css/story-rpg.css`, `life-game.html` cache versions; extend `tests/contextual-actions.test.js`.

**Interfaces:** New `contextualActionHtml(remainingEnergy)` consumes `ContextualActions.lanes`; action tile uses `data-arcade-act` and dispatches to existing `triggerAction`.

- [ ] Add failing UI tests verifying five rendered categories, true costs, correct locked states, character-modified odds, data attributes for real actions, direct click handler, and retained legacy priority/browse navigation.
- [ ] Run focused tests and record failures.
- [ ] Implement compact SVG/icon cards with clear outcome-quality label; scope CSS to new cards with mobile single/two-column rules and reduced motion.
- [ ] Run focused tests then `npm test`.
- [ ] Commit as `feat(ui): add five contextual arcade action lanes`.

### Task 4 — Full verification and isolated branch delivery

**Files:** Add `docs/superpowers/reviews/2026-11-17-phase2-evidence.md` with observed commands/results only; change tests/production only through an additional test-first red/green cycle if review finds an issue.

- [ ] Run all modified JS files through `node --check` and `npm test`.
- [ ] Run `npm run diagnostic:world` and `npm run diagnostic:npcs`; record exit codes.
- [ ] Run actual headless Chrome interaction plus widths 320, 390, 768, 1440 px; evaluate document/sheet/action-card horizontal overflow, visible check odds and single-click behavior.
- [ ] Inspect `git diff --check` and `git diff --name-only f4f6196...HEAD`; assert protected map file changes = 0.
- [ ] Commit evidence; publish only isolated feature branch. No automatic PR merge. Report limitations including no human playtest data.
