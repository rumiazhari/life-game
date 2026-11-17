# Life File Phase 3 — Consequential Career and Underworld Arcs

**Date:** 2026-11-17 (JST)
**Base:** `master` at `632b16479a43d4aa581ff3e7cc1674a1b6e359ae`
**Feature branch:** `feat/arcade-rpg-consequence-arcs-20261117`

## Source-backed implementation
- Added **The Reference File**, **The Next Interview**, **The Grey Manifest**, **The Witness List** as four opt-in episodes in `js/systems/story-consequence-arcs.js` (8 original quests preserved; 12 total).
- Eligibility and scene prose refer to canonical `World.storyArchive`: career echoes previous wage/ward cases and caregiving; underworld echoes Night Market and Ward hearings. New follow-ups become available **only in a subsequent year**.
- Career salary changes use the **original business and original employment contract ID**. Actual coworker NPCs receive canonical `npcBond` and `RelationshipMemory`; no fabricated NPC is created.
- Manifest outcomes use canonical scrutiny, money, relationship memory, story evidence and 3d6; guaranteed options preserve fail-forward.
- Generalized the unfinished quest filing guard; an employment-system exception can no longer turn a contract-scoped salary raise into direct cash.
- All four new episodes cost **one existing annual energy** upon successful chapter start through the existing `markActionDone('story-chapter:'+runId)` mechanism. Dialogue/rolls are free. Existing wage chapters remain cost 1 and other legacy quests retain cost 0.
- Updated browser script-cache query versions for modified story engine, adapter and UI; added CAREER/UNDERWORLD story art mappings. No additional persistent record or simulation system.

## Verification performed on AEROMI
- Pre-existing Phase 2 merged base: **1,004 tests passed** from previous turn; no changes to Phase 2.
- Phase 3 initial new episode tests: RED prior to implementation, then GREEN 4/4.
- Consequence tests reproduced and corrected early-filing and scoped salary exception bugs.
- Energy integration tests reproduced missing energy metadata/debit; later GREEN 27/27 focused.
- Cache-version test reproduced stale references, then GREEN.
- Fresh final `npm test`: **1,020 tests; 1,020 pass; 0 fail**.
- `npm run diagnostic:world`: exit **0**.
- `npm run diagnostic:npcs`: exit **0**.
- `node --check` on every modified JS file: all **0**.
- Browser headless Chrome on `life-game.html`: career and underworld cards visible with `1 ENERGY`; 320/390/768/1440 px document, story panel and card horizontal overflow all **0**.
- Live click `quest_reference_file`: energy 0 → 1; `story:00001` started; exactly one story action in done ledger; three valid choices including a guaranteed one. Dialogue included **wage dispute** and **household care** history from real archive fixture.
- `git diff --check` clean; **0 changes** to `js/map.js`, `js/state.js`, `js/systems/world-gameplay.js`, `assets/maps/**`.

## Review limitations
- Tests cover deterministic check outcomes, reference integrity, salary isolation, one-shot rewards, gating, UI and responsive layout. They do **not** measure subjective enjoyment.
- No independent reviewer/subagent was available in this session; author self-review plus observed test and browser evidence only.
- No new map work, map branch merge, or game-mechanic restructuring was performed.
