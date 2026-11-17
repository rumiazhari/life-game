# RPG Phase 9 — Cross-domain event chain verification

**Date:** 2026-11-17 JST. **Base:** master `09d48e98e6b29b3eff662d9522e31c96798a7dc1`; **branch:** `feat/rpg-phase9-emergent-threads-20261117`.

## Implemented
Added `js/systems/story-threads.js` as a transient StorySystem adapter; persistent gameplay authority remains StorySystem, with only `World.storyThreadStages={work:0..2,household:0..2}` for exactly-once stage protection even after archive eviction. Work→Civic requires actual filed contextual employer and civic/Ward histories and references a real business; creates **The Public Record** and next-year **Return: The Council Reply**, with Bureau/Labor checks and guaranteed exit. Household→Underworld requires a previously filed Social story with a real living NPC and an actual market/manifest chapter; creates **The Debt at Home** and next-year **Return: Family Testimony**, with NPC bonds/memory, checks, and guaranteed exit. No invented salary, job, legal record or person; no additional authored quest catalogue entries. All 3d6 rolls route through canonical StorySystem seeded streams. If NPC dies or moves, dependent choices disable but a safe exit persists. All choices consume existing annual-energy budget only on successful start.

## Observed RED→GREEN / invariants
- Initial focused RED when module absent; source typo in apostrophe corrected, then `node --test tests/story-threads.test.js`: **9 passed, 0 failed**.
- Focused tests cover real prerequisites, two first stages, exactly-two later-year echoes, stable company/NPC identity, 3d6 success/failure routes, no-energy and stale-year guards, no duplicates, bounded stage progression after 80-year skip, and guarded NPC death.
- Full fresh `npm test`: **1,083 passed, 0 failed**.
- `npm run audit:rpg`, `npm run simulate:rpg`, `npm run diagnostic:world`, `npm run diagnostic:npcs`: all exit **0**; `node --check js/systems/story-threads.js` exit **0**. The existing authoring audit and simulator cover the original twelve authored chapters; Phase 9's dynamically generated chapters are covered by focused integration tests.

## AEROMI real Chrome headless
The actual `life-game.html` Stories panel showed two new leads, **The Public Record** (real workshop) and **The Debt at Home** (real living NPC). No document, sheet, or card horizontal overflow at **320/390/768/1440 px**. Starting the work chapter by clicking its card consumed **one annual energy (0→1)**, provided three choices with a guaranteed opt-out, applied its ending, and filed exactly one archive. Same-year callback remained unavailable; after incrementing `World.year` by one, the continuation became available (stage 1). Initial QA measured energy after incrementing the game year and misleadingly reported zero; corrected test timing verified the annual ledger properly. No human playtesting or physical Android test.

## Boundaries
No protected map/travel files changed; no changes to original economic authority or real NPC registry. Phase 9 implementation adds two multi-year cross-domain chains, not broad automatic emergent world simulation. External independent code review not conducted; all evidence from direct tests and browser interaction.
