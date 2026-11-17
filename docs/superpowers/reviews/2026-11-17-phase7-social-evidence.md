# RPG Phase 7 verification — NPC reciprocity, rivalry and trust

**Date:** 2026-11-17 JST. **Base:** `23e4ef0ae442cfd469e033bc4f54b841513f6a07`. **Branch:** `feat/rpg-phase7-relationship-consequences-20261117`.

## Implemented
The additive `story-social.js` module selects an **existing, alive, connected NPC** using authoritative `NpcSystem.relationship` trust/conflict and `RelationshipMemory.modifier`. Rival, ally and uncertain stances alter prompt, preview odds and NPC-specific options. Each encounter has a reconciliation check, confrontation/betrayal check, and guaranteed withdrawal. Story effects use canonical NPC bonds, valenced memories, bounded status changes and original StorySystem archive/merit. A single `World.storySocialYear` high-water marker prevents a second encounter that year after eviction; subsequent years remember the same NPC's earlier ending while the person remains valid. If an NPC dies or moves, the two NPC-dependent options are disabled and the guaranteed exit remains. No imaginary contacts or second social graph.

## TDD, regression and diagnostics
- Initial focused RED showed missing StorySocial. After implementation, a fresh-life/late-life edge case and browser script-order bug were found and corrected; added focused checks for exact script order and save/reload.
- Focused `node --test tests/story-social.test.js`: **9 passed, 0 failed**.
- Full `npm test`: **1,065 passed, 0 failed**.
- `npm run audit:rpg`, `npm run simulate:rpg`, `npm run diagnostic:world`, `npm run diagnostic:npcs`: **all exit 0**.
- `node --check js/systems/story-social.js`: exit 0.
- Two identical 65-year scripted NPC encounters preserved StorySystem invariants and the bounded 64-archive limit; these were **not** full mortality simulations.
- Tests cover living NPC identity, rival selection, real trust/bond changes, positive/negative memories, deterministic 3d6 fail-forward, once-only archive/merit, one-energy start, NPC death exit, callback timing, missing relationships, and save/reload.

## Actual browser on AEROMI
Chrome headless loaded the real `life-game.html` and displayed **A Rival's Reckoning** for a real living mother NPC. Clicking the actual card charged exactly **1 annual energy**; all three options were present with a guaranteed route; one story was filed with exactly one archive. No horizontal overflow in document, sheet or card at **320/390/768/1440 px**. UI automation did not constitute a human playtest.

## Boundaries
The work touches only one new story module, its tests, the script reference in HTML and phase documents; map/travel files remain untouched. Subjective replayability and balance require real voluntary player observations. An independent external reviewer has not evaluated this phase; evidence is direct code inspection plus first-hand automated and browser tests.
