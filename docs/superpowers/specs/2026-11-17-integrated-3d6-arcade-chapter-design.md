# Life File — Integrated 3d6 Arcade RPG: First Playable Chapter

**Status:** Approved architecture; implementation not yet started  
**Approved:** 2026-11-17  
**Repository:** rumiazhari/life-game  
**Baseline:** `master` at `3df761f0dd4f0fa8f437a68b5a94351a883f8577`  
**Feature branch:** `feat/arcade-rpg-wages-20261117`

## Intent and player experience
Make Life File feel like a fast, consequential, visually readable RPG without adding a second game or invalidating its persistent simulation. The first playable slice upgrades the *existing* `quest_wage_file` (The Missing Wages) and `quest_wage_aftermath` (The Next Pay Packet), not a disconnected quest catalogue.

Loop: **encounter → select approach → optionally roll existing 3d6 → immediate consequence → durable memory/economy effect → next-year callback**. Present only actionable costs, odds, outcomes, and short expressive text by default. Treat selection and dialogue within a chapter as one playable encounter, not additional years.

## Existing authority and preserved work
- `RPG` in `js/systems/rpg-system.js` owns 3d6 checks, six domains, backgrounds, grades, merit, and perks. `story-rpg-checks.js` already computes exact odds over 216 equiprobable outcomes. No D20 conversion or new skill/XP currency.
- `StorySystem` owns `World.storyRuns`, `World.storyArchive`, and `World.storyItems`; `story-quest-engine.js` extends rather than replaces it. Continue using its deterministic `WorldSimulation.streamFor` and one-shot choice guard.
- `EmploymentSystem` owns contracts and pay changes; `RelationshipMemory` owns recurring relationship history; `S.__doneActions[year]` is the *existing* annual action ledger. No duplicate state authority.
- Protect the ongoing map development. Do not edit `js/map.js`, `js/state.js`, `js/systems/world-gameplay.js`, `assets/maps/**`, national/settlement rendering, routes, travel semantics, or any map branch. Preserve Android layout behavior.
- Existing map merged in `master` from Lithuania 2.5D work. Open alternative PR #16 and all existing branches remain untouched. No automatic merge.

## UX and concrete scope
1. On opening the Stories panel, if the player has no background, show three compact, one-time options from `RPG.BACKGROUNDS` (Street Raised, Scholar's Child, Veteran Household). Selection calls `RPG.setBackground(World,'subject',id)` and shows resulting check implications; it does not spend annual energy. Existing characters with backgrounds remain unchanged.
2. Show one next story, its relevant cost, and up to three distinct approaches. Keep all eligible quests discoverable. Use existing portraits, story SVG, dice animation, and current responsive styles; do not invent a new rendering system.
3. The first `quest_wage_file` and its `quest_wage_aftermath` cost **one existing annual action-energy unit on successful quest start**, not one unit per dialogue or roll. Use the same `planHours()/energyUsed()/markActionDone()` ledger as routine actions. At zero remaining energy, starting a chapter is unavailable and does not create a run. Charging the chapter once avoids trapping a player in an unfinished encounter with no actions left. Other quests keep their current behavior in this first slice; show their actual cost.
4. Preserve current 3d6 targets 7/9/11/13 and final modifier clamp [-4,+4]. Preview exactly the resolver's outcome count, costs, and forced/guaranteed choices; never reroll an already resolved scene.
5. The Missing Wages keeps the existing evidence, direct negotiation, and collective-action routes. Preparation may grant `wage_copy`, influencing the documented Bureau roll. Failure must lead to a visible fallback or to the existing next-year `quest_wage_aftermath`, not a repeat-roll button.
6. Bind wage outcomes to the **original employer**. A `jobRaise` from this chapter may change salary only if the original contract/employer remains active; if the worker changes jobs, no invented cash windfall or salary adjustment to the new employer. Distinguish a prospective wage increase from repayment of arrears. No second payroll transaction.
7. If the quest binds a real coworker NPC, add that NPC's stable ID as a participant in the existing `RelationshipMemory` event. The fallback for worlds with no peer remains safe and must not invent a person.
8. Each completed wage chapter yields **60 merit once** as provisional first-slice progression tuning, instead of the existing 20; all resolutions receive the same amount. This reaches grade II for a new character and opens the existing one-slot perk selection. Other quests keep their current 20-merit award. Perk selection invokes existing `RPG.unlockPerk`; visible options are actual eligible perks only. No independent specialization state.
9. Keep fast-forward from auto-resolving player-committed quests. Existing Chapter/archive and succession behavior is retained; no new save management in this slice.

## Non-goals
No D20 engine, combat system, dungeon, action timer, quest currency, additional permanent character stats, new world map, general rewrite of 58 base actions, new GoalSystem, or broad chapter expansion. Do not alter existing simulation ordering to accommodate an encounter.

## Acceptance gates
- **A1:** Exact 3d6 odds equal resolver outcomes for each difficulty and every clamped modifier. Same commitment never rerolls.
- **A2:** At least three materially distinct wage approaches and one guaranteed fallback are available through deterministic fixtures.
- **A3:** First chapter start costs precisely one annual energy; no cost for dialogue/roll; blocked starts spend zero and create no run; normal actions share the same remaining budget.
- **A4:** One background selection persists and changes the applicable checks; after the first chapter, player can unlock an eligible perk with the existing grade/slot rules.
- **A5:** ≥2 distinct persistent effects, coworker memory when a real coworker is bound, and existing next-year callback regardless of previous ending; fail-forward remains available.
- **A6:** Same-year/stale-year guards, one-shot awards, migration/idempotency, no duplicate salary or money, bounded values, no invalid references.
- **A7:** Diff contains zero protected map files; `tests/lithuania-25d-map.test.js` and other map regression tests still pass.
- **A8:** Browser checks at 320, 390, 768, and 1440 px show no horizontal overflow and visible disabled/guaranteed/3d6 actions.
- **A9:** Focused story/RPG tests, `npm test`, `npm run diagnostic:world`, `npm run diagnostic:npcs` complete successfully.
- **A10:** Separate, later formative evaluation: 6–8 human sessions; provisional median enjoyment and agency ≥5/7; ≥80% can explain an outcome. This is a playtest gate, not an automated unit test and not a claim of observed performance.

## Considered approaches
1. **New D20 RPG engine — rejected.** Conflicts with established 3d6 semantics, tests and old saves.
2. **Add quests only — rejected.** Expands content without connecting energy, backgrounds, perks and NPC memory.
3. **Integrate arcade UX with current 3d6, StorySystem and World — selected.** Minimum new authority, high compatibility, measurable first slice.

## Validation
Use red/green TDD per task. Review branch diff against protected map paths, run `node --test tests/story-quests.test.js tests/rpg-system.test.js`, focused new tests, full `npm test` and world/NPC diagnostics, then headless Chrome widths. Mark implementation complete only from observed run results; do not merge without a separate explicit decision.