# AUTOPILOT STATE — Life Game

**STATUS:** OK  
**Current phase:** Phase 4C — Businesses and Employment  
**Last verified:** 2026-08-26  
**origin/master SHA:** 454511635a2837d97b67962463b2c25d7e51aecc  

## Backlog (top-down, roadmap order)

1. **4C-7 — Ownership and entrepreneurship** ✅ COMPLETE  
   - ✅ Extend `BusinessRecord` with ownerNpcId population logic  
   - ✅ Implement business startup / share allocation API (`ensure/create` for new businesses with owners)  
   - ✅ Add dividend / profit-distribution flow wired into `tickWorld`  
   - ✅ Persistence + migration for owner fields (idempotent repair)  
   - ✅ Focused tests: business creation, dividend flow, owner migration (4 new tests, 870 total pass)  

2. **4C-8 — Employer UI**  
   - Add `js/ui/employment-ui.js` business panel (status, finances summary, employee list)  
   - Contract history view backed by `EmploymentSystem` APIs  
   - Vacancy-browsing/application UI backed by 4C-4/4C-5  
   - Workplace-relationship UI (4C-6 already built)  
   - Full retirement of legacy `rollJobVacancies()` / flat `INC[]` income path  

3. **Phase 5 — Government / law / politics** *(future, after 4C complete)*  
   - `js/systems/government-system.js`  
   - `js/systems/law-system.js`  

4. **Phase 6 — Advanced health / reproduction** *(future)*  
   - `js/systems/pregnancy-system.js`  

5. **Phase 12 — Saves / release** *(future)*  
   - Save / load system for `World` / `Business` / `EmploymentContract` state  

## Active development: 4C-7 Ownership/Entrepreneurship — COMPLETE

All three sub-goals implemented and verified:

1. **ownerNpcId auto-assignment**: `BusinessSystem.create` now auto-assigns the first alive non-subject NPC at the settlement as owner when no explicit `ownerNpcId` is provided. Migration preserves ownerNpcId as-is.

2. **Dividend flow**: `tickWorld` distributes 10-20% of business profit to the owner NPC deterministically via `WorldSimulation.streamFor(world, year, business.id, 'business-dividend')`. Dividend subtracted from business profit, added to owner NPC `employment.income`. History recorded with `{type:'dividend', year, amount, recipient}`.

3. **Explicit owner override**: `BusinessSystem.create` accepts `ownerNpcId` spec parameter; when provided, it is used instead of auto-assignment.

Tests: `tests/business-system-ownership.test.js` (4 tests, all passing). Full suite: 870/870 pass, 0 fail.

## Next iteration target: 4C-8 Employer UI

Build `js/ui/employment-ui.js` to surface business status, finances summary, and employee list to the player. Must read from `BusinessSystem` and `EmploymentSystem` APIs only — no legacy state duplication.

## Lock

`.autopilot.lock` present, age < 20 min — run in progress, per protocol.