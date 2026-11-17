# Integrated 3d6 Arcade RPG — Missing Wages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Missing Wages and Next Pay Packet quests a compact, testable RPG chapter with character choice, a shared annual action cost, durable consequences, and an attainable perk.

**Architecture:** Keep `RPG`, `StorySystem`, `EmploymentSystem`, and `RelationshipMemory` authoritative. The opt-in quest adapter exposes the chapter's single energy cost; the existing UI action ledger records it. Improve only the existing wage episode and existing Stories panel; neither travel nor map code changes.

**Tech Stack:** Vanilla ES JavaScript in direct script tags, Node.js built-in test runner, existing VM test loader and browser UI. No new package or build dependency.

**Spec:** `docs/superpowers/specs/2026-11-17-integrated-3d6-arcade-chapter-design.md`

## Global Constraints
- Start from baseline `master` SHA `3df761f0dd4f0fa8f437a68b5a94351a883f8577` in isolated branch `feat/arcade-rpg-wages-20261117`. Check current remote HEAD before coding; rebase only with inspected changes.
- No modification to `js/map.js`, `js/state.js`, `js/systems/world-gameplay.js`, `assets/maps/**`, or map branches.
- Reuse 3d6 targets 7/9/11/13 and modifier [-4,+4], not D20. Preview and resolver must agree over all 216 outcomes.
- No second game state, skill set, action currency, money/payment path, or untracked RPG progress ledger.
- The first wage chapter and wage follow-up each cost one **existing** annual energy unit on chapter start, zero for subsequent dialogue/rolls; other quests retain existing behavior.
- Existing grade thresholds, background and perk APIs stay intact. Provisional first-wage reward is 60 merit per completed chapter, one-shot, instead of 20; other chapters remain 20.
- Maintain one live story run, deterministic streams, persisted effects and annual idempotency. Preserve no-auto-resolve for player-chosen quests.
- No automatic merge or deployment. Tests, diagnostics and browser QA must actually run before completion is claimed.

## Review Focus
1. **Zero energy/custody:** Player can view story cards but cannot start a paid wage chapter; no run, counter, energy or RNG state changes. Test Task 2.
2. **Double click and rejected start:** Two rapid attempts must not charge twice; already-active/story-blocked starts cannot charge. Test Task 2.
3. **Job changed mid-chapter:** Raise must never target a different employer or become a fictional cash payout. Test Task 3.
4. **Absent coworker/old RPG record:** No fictitious NPC reference or crash; a saved background is preserved. Test Tasks 1 and 3.
5. **Repeated archive/old save/fast-forward:** No duplicate merit or NPC effects, no 3d6 reroll, committed active quest not silently auto-played. Test Task 4 and final gate.

## File Responsibilities
- `js/systems/story-quest-engine.js`: decorate existing quest data, start-cost preflight, authoritative one-shot wage reward at filing.
- `js/systems/story-quests.js`: wage branch consequences and bound coworker participants using existing effect operations.
- `js/systems/story-system.js`: narrow contract-scoped `jobRaise` safety; leave other episodes unchanged.
- `js/ui/story-quest-ui.js`: background/perk picker and visual story costs; existing `startQuest` call integration.
- `js/ui.js`: existing yearly energy ledger counting synthetic chapter-start IDs, no extra action currency.
- `css/story-rpg.css`: compact responsive choices, cost badges and disabled states.
- `tests/story-arcade.test.js` (new): deterministic integration/character/energy/outcome tests.
- `tests/story-quests.test.js` and `tests/rpg-system.test.js` (existing): preserve and augment focused regression checks.

---

### Task 1: One-time character identity and useful existing perk selection

**Files:** Modify `js/ui/story-quest-ui.js` and `css/story-rpg.css`. Test `tests/story-arcade.test.js` (new).

**Interfaces:**
- Consumes `RPG.recordFor(world,'subject')`, `RPG.BACKGROUNDS`, `RPG.PERKS`, `RPG.setBackground(world,'subject',bgId)`, `RPG.unlockPerk(world,'subject',perkId)`.
- Produces compact, purely projected Stories-panel controls. Does not invent `World.characterClass` or new inventory/skill fields.

- [ ] **Step 1 — Write failing tests:** New subject sees the three existing backgrounds; selecting `scholar` calls `RPG.setBackground` once and persists the RPG record; repeated selection refuses to overwrite it; legacy subject with already-set background sees no reset; record missing/older schema does not crash. Seed a grade-II subject and assert exactly one eligible perk unlock succeeds, the second is rejected by the existing capacity rule, and the chosen perk changes the appropriate check odds.
- [ ] **Step 2 — Verify red:** Run `node --test tests/story-arcade.test.js`; expect assertion failures for missing UI entry points rather than syntax/setup errors.
- [ ] **Step 3 — Implement:** Render character choices from existing data in `renderBoard()` and attach event delegation on the existing `storySheet` element; derive available perk choices by grade, existing capacity and held-perk state, invoke existing APIs, and immediately re-render. Keep screens compact and accessible.
- [ ] **Step 4 — Verify green:** Repeat focused test; run `node --test tests/rpg-system.test.js tests/story-quests.test.js`; expect PASS for all.
- [ ] **Step 5 — Commit:** Stage only these new/edited files and commit `feat(rpg): expose character backgrounds and earned perks`.

### Task 2: One existing annual-energy debit per wage chapter

**Files:** Modify `js/systems/story-quest-engine.js`, `js/ui/story-quest-ui.js`, `js/ui.js`. Test `tests/story-arcade.test.js` and existing `tests/dossier-command-ui.test.js`.

**Interfaces:**
- Extend objects from `StorySystem.availableQuests(world, opts)` with `energyCost: 1` for `quest_wage_file`/`quest_wage_aftermath` and `0` otherwise.
- Extend `StorySystem.startQuest(world,id,{subject,lineage,year,remainingEnergy})`: optional finite `remainingEnergy` preflight; reject inadequate funds with `{ok:false,reason:'no_energy'}` before creating a run. Existing headless/direct callers omitting this UI-only field keep their current behavior.
- After a *successful* UI start only, call existing `markActionDone('story-chapter:'+runId)`. Teach `energyUsed()` to count a valid `story-chapter:story:NNNNN` ID as one unit alongside `PUR_MAP`/`DEC_MAP`, without adding an independent action balance.

- [ ] **Step 1 — Write failing tests:** In fixture with remainingEnergy 0, starting a wage chapter returns `no_energy` and leaves `storyRuns`/`storyCounter` unchanged. At remainingEnergy 1, one paid start succeeds and ledger use rises exactly 1. Dialogue and two rolls consume zero extra units; a duplicate start/blocked active run adds zero. Existing normal action and wage start cannot jointly overspend `planHours()`. A free existing non-wage quest continues to behave as before.
- [ ] **Step 2 — Verify red:** Run `node --test tests/story-arcade.test.js tests/dossier-command-ui.test.js`; expect the new budget assertions to fail.
- [ ] **Step 3 — Implement:** Report cost on chapter cards, disable paid starts when `Math.max(0,planHours()-energyUsed()) < 1`, pass `remainingEnergy` from the board, and debit only after `startQuest().ok`. Use only the current yearly done-actions ledger. No energy charge inside `StorySystem.choose`, avoiding mid-scene deadlocks.
- [ ] **Step 4 — Verify green:** Re-run focused tests, including twice-clicked start and no-energy fixture. Confirm existing `fastForward()` behavior still preserves an unfinished player-chosen quest.
- [ ] **Step 5 — Commit:** `feat(rpg): charge wage chapters using existing annual energy`.

### Task 3: Real wage and coworker consequences

**Files:** Modify `js/systems/story-quests.js` and narrow `jobRaise` case in `js/systems/story-system.js`. Test `tests/story-arcade.test.js` and `tests/story-quests.test.js`.

**Interfaces:**
- Add optional `participants` array to the existing `mem(type,summary,valence,participants=[])` helper. For wage episode outcomes, use the stable coworker `npcId` from the cast if present; otherwise retain the safe existing town fallback.
- Add optional `requireBusinessId` to the existing `{kind:'jobRaise',amount,...}` effect. With this field, the StorySystem effect applies `EmploymentSystem.adjustSalary` only to an active subject contract whose `businessId` matches the original employer; otherwise do nothing. Existing unrelated `jobRaise` operations keep prior behavior.

- [ ] **Step 1 — Write failing tests:** Provide a world with an actual business, employee contract, and coworker NPC. Resolve the restored, compromise, and reprisals wage endings with deterministic streams; assert different authoritative salary/scrutiny changes and a memory participant equal to the coworker's stable NPC ID. Resign or change employer between chapter start and ending; assert no change to the new contract and no direct cash award. Run a no-peer fixture; assert no malformed reference, no crash.
- [ ] **Step 2 — Verify red:** Run `node --test tests/story-arcade.test.js tests/story-quests.test.js`; expect missing employer guard and memory participant assertions to fail.
- [ ] **Step 3 — Implement:** Carry original company ID in wage ending effects and coworker participant into memory effects; narrow the existing `jobRaise` implementation under `requireBusinessId`, without changing non-wage behavior.
- [ ] **Step 4 — Verify green:** Re-run focused tests; inspect one wage payout/household simulation sequence to confirm one normal salary payment path and no arrears cash invention.
- [ ] **Step 5 — Commit:** `fix(rpg): bind wage effects to original employer and coworker`.

### Task 4: First-chapter progression and fail-forward verification

**Files:** Modify `js/systems/story-quest-engine.js`, `js/ui/story-quest-ui.js` and, only if required for clearer outcomes, existing wage lines in `js/systems/story-quests.js`. Test `tests/story-arcade.test.js` and `tests/story-quests.test.js`.

**Interfaces:**
- `StorySystem.fileAway(world,runId,{year})` only grants wage merit after an actually finalized ending; use `RPG.addMerit(world,'subject',60,'quest:'+run.id,year)` for `quest_wage_file` and keep `20` for others.
- Existing `RPG.unlockPerk` performs available selection after a new character reaches grade II; no separate perk allocator.
- Existing `StorySystem.availableQuests` and `quest_wage_aftermath` continue gating callback to the subsequent year.

- [ ] **Step 1 — Write failing tests:** Fresh grade-I character ends wage chapter by either a successful or non-successful route; verify exactly 60 merit, grade II, one existing eligible perk slot, and a useful selected perk. Attempt to file unfinished run: no award. File same ended run twice: no second award. Verify the follow-up only opens next year after every wage ending, and an unsuccessful branch has a feasible continuation/callback. Verify committed quest still pauses rather than fast-forwarding through player's choice.
- [ ] **Step 2 — Verify red:** Run `node --test tests/story-arcade.test.js tests/story-quests.test.js`; expect award and unfinished-file assertions to fail.
- [ ] **Step 3 — Implement:** Add targeted wage reward/ended guards and make the outcome receipt explicitly distinguish prospective wage change from recovered arrears. Do not create a second reward ledger; rely on canonical finalized run/file guard.
- [ ] **Step 4 — Verify green:** Run new tests and the original entire RPG/story test sets; check deterministic replay on fixed seeds.
- [ ] **Step 5 — Commit:** `feat(rpg): make first wage chapter grant meaningful existing progression`.

### Task 5: Visual polish, complete regression, and review gate

**Files:** Modify only `css/story-rpg.css` and optionally `js/ui/story-quest-ui.js`; amend focused UI tests when behavior requires. No map assets or routes.

**Interfaces:** Existing Stories, episode overlay, and Android responsive stylesheet remain authoritative; no framework or dependency introduced.

- [ ] **Step 1 — Write failing browser/UI assertions:** On 320/390/768/1440 px, background selection, wage chapter cost, three approaches, exact 3d6 odds, guaranteed decisions, and result receipt stay within viewport with no horizontal scrolling; disabled choices explain their reason. Add static load-order assertions where current test harness cannot simulate actual layout.
- [ ] **Step 2 — Verify red where new checks apply:** Run the relevant UI regression tests against the pre-polish layout, record findings.
- [ ] **Step 3 — Implement minimal CSS/UI changes:** Use existing story artwork/dice motion and reduced-motion handling; do not expand the full dossier or override map styles.
- [ ] **Step 4 — Verify green and review:** Run `node --check` on edited JS; `node --test tests/story-arcade.test.js tests/story-quests.test.js tests/rpg-system.test.js tests/lithuania-25d-map.test.js`; `npm test`; `npm run diagnostic:world`; `npm run diagnostic:npcs`; browser checks at four widths. Run `git diff --name-only master...HEAD` and explicitly reject protected map paths.
- [ ] **Step 5 — Commit and prepare review:** `test(rpg): verify arcade wage chapter and preserve map regressions`. Publish an evidence summary of real test/diagnostic outputs and changed files. Do not claim A10 human enjoyment targets are met without actual playtests; do not merge automatically.

## Completion and handoff
The first playable slice is technically complete only when A1–A9 pass with recorded outputs and a separate review sees no authority/migration/determinism defects. A10 is deferred to a human playtest, separately reported. Existing map branch work continues independently.