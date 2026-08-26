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

2. **4C-8 — Employer UI** *(slice 1 done 2026-08-26; slices 2-3 remain)*   ✅▶️  
   - ✅ `js/ui/employment-ui.js` business panel (status, finances summary, employee list)  
   - ✅ Contract history view backed by `EmploymentSystem` APIs (`contractHistoryView`)  
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

## Active development: 4C-8 Employer UI — slice 1 COMPLETE

`js/ui/employment-ui.js` (`EmploymentUI`, presentation-only, read-only):
- `businessPanel(world, businessId, options)` — status badge, settlement/kind/
  sector meta, owner line (resolves `ownerNpcId`, 4C-7 aware), finances grid
  (cash/debt + last annual revenue/expenses/payroll/profit when
  `finances.lastYear != null`), staff list from
  `EmploymentSystem.activeForBusiness` (on-leave flagged), open-vacancy count,
  past-staff count, last 3 business-history entries.
- `contractHistoryView(world, personId, options)` — every contract newest
  first: occupation @ business, year range, salary, status label,
  termination reason.
- Reads exclusively through `BusinessSystem`/`EmploymentSystem` APIs; degrades
  to friendly unavailable panels when the systems are absent; never mutates
  World/S (verified by a JSON before/after snapshot test).
- Wired into `life-game.html` after persistent-people-ui.js.
- Tests: `tests/employment-ui.test.js` (4 tests). Full suite: **874/874 pass**.

## Next iteration target: 4C-8 slice 3 — ownership decision surface

1. Founder/closure ACTIONS (4C-7): player decisions routed through
   `BusinessSystem.create` / `BusinessSystem.close` (e.g. "Found a business"
   decision with cash stake deducted into `finances.cash`, ownerNpcId
   'subject'; "Shut down" for businesses the subject owns). Presentation in
   js/ui/employment-ui.js or ui.js helpers only; sim mutations ONLY via the
   system APIs.
2. Then evaluate full retirement of the legacy `rollJobVacancies()` / flat
   `INC[]` fallback path per the phase-page completion criteria.

### Done in iter 4 (2026-08-26)
- FIXED iter-3 bug: personal standing panel guarded
  `typeof EmploymentUI==='function'` but EmploymentUI is an object, so it never
  rendered; it also passed `S.employmentContractId` (a contract id) where a
  business id belongs. Now `employmentUiPanels()` resolves the active contract
  via `EmploymentSystem.activeForPerson(World,'subject')[0].businessId`.
- NEW `EmploymentUI.ownershipPanel(world,personId,options)` — read-only list of
  businesses owned by a person (active first), each with status badge,
  settlement/kind/sector, last annual result, and dividends received total +
  most recent payout from `history[type=dividend]`. Degrades gracefully without
  BusinessSystem; never mutates World/S (JSON snapshot tested).
- Wired into the personal standing panel next to the employer panel.
- Cache-bust bumps in life-game.html for both files.
- Tests: tests/employment-ui.test.js 6/6 (2 new). Full suite **876/876 pass**.

## Lock

`.autopilot.lock` present, age < 20 min — run in progress, per protocol.