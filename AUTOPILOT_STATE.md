# AUTOPILOT STATE — Life Game

**STATUS:** OK  
**Current phase:** Phase 4C — Businesses and Employment  
**Last verified:** 2026-08-26  
**origin/master SHA:** 454511635a2837d97b67962463b2c25d7e51aecc  

## Backlog (top-down, roadmap order)

1. **4C-7 — Ownership and entrepreneurship**  
   - Extend `BusinessRecord` with ownerNpcId population logic  
   - Implement business startup / share allocation API (`ensure/create` for new businesses with owners)  
   - Add dividend / profit-distribution flow wired into `tickWorld`  
   - Persistence + migration for owner fields (idempotent repair)  
   - Focused tests: business creation, dividend flow, owner migration  

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

## Active development: 4C-7 Ownership/Entrepreneurship

**Progress:** 2 of 3 sub-goals complete.

- ✅ **ownerNpcId auto-assignment**: `BusinessSystem.create` now auto-assigns the first alive non-subject NPC at the settlement as owner when no explicit `ownerNpcId` is provided. Migration preserves ownerNpcId as-is.
- ✅ **Dividend flow**: `tickWorld` now distributes 10-20% of business profit to the owner NPC deterministically via `WorldSimulation.streamFor(world, year, business.id, 'business-dividend')`. Dividend subtracted from business profit, added to owner NPC `employment.income`. History recorded.
- **Remaining:** Implement business startup / share allocation API — explicit ownerNpcId override in `BusinessSystem.create` and share tracking schema extension.

**Recent progress:** 4C-6 workplace life is already built (commits 8266247, 2b308e8). No `Math.random` usage in replayable annual-simulation systems (verified: `WorldSimulation.streamFor` used exclusively for seeded streams). `npm test` baseline: 866/866 pass, 0 fail.

## Lock

`.autopilot.lock` present, age < 20 min — run in progress, per protocol.