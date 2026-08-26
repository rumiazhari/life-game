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
- Tests: `tests/employment-ui.test.js` (4 tests). Full suite: **880/880 pass**.

## Next iteration target: 4C-8 slice 3 — ownership decision surface

1. Founder/closure ACTIONS (4C-7): player decisions routed through
   `BusinessSystem.create` / `BusinessSystem.close` (e.g. "Found a business"
   decision with cash stake deducted into `finances.cash`, ownerNpcId
   'subject'; "Shut down" for businesses the subject owns). Presentation in
   js/ui/employment-ui.js or ui.js helpers only; sim mutations ONLY via the
   system APIs. **(DONE in iter 5 — see below)**
2. Then evaluate full retirement of the legacy `rollJobVacancies()` / flat
   `INC[]` fallback path per the phase-page completion criteria.

### Done in iter 5 (2026-08-26)
- REPAIRED a corrupted `js/data.js` block from a crashed prior run: the
  `payoffdebt` decision had lost its object-closing brace and the
  `foundBusiness`/`shutDownBusiness` entries were fused into one syntactically
  invalid object, breaking the ENTIRE suite (file failed to parse). Restored
  both as clean, well-formed decision objects.
- IMPLEMENTED 4C-8 slice 3 ownership actions, routed strictly through
  `BusinessSystem`:
  - `foundBusiness` — gated on age≥18, not in school, freedom≥40, assets≥$5,000,
    and no existing subject-owned business; on apply calls
    `BusinessSystem.create(World,{settlementId, sector:'professional',
    ownerNpcId:'subject', finances:{cash:5000}})` so the $5,000 stake lands in
    the business ledger (not just S.assets), deducts S.assets and S.freedom via
    the normal `applyFx` path. Settlement resolved by
    `subjectSettlementId()` (subject location → active settlement → any).
  - `shutDownBusiness` — gated on owning ≥1 active business; on apply calls
    `BusinessSystem.close(World, id, 'player_initiated', year, {subject:S})`,
    which terminates employment contracts and withdraws vacancies via the
    system. Inert with a clear `no_owned_business` reason when none owned.
  - Added helper functions `ownedActiveBusinesses()` and `subjectSettlementId()`
    in `js/data.js` (no authoritative-state duplication; read-only queries).
  - Extended `STATKEYS` with `freedom`/`scrutiny` labels so decision fx chips
    render correctly (additive; existing px paths unchanged).
- NEW `tests/ownership-decisions.test.js` (4 tests): gating logic, real
  BusinessSystem record creation with stake deposit + subject ownership,
  closure terminating the business's employment contracts, and inert-no-op when
  nothing is owned. All drive the live systems; none fabricate state.
- Full suite: **880/880 pass** (was 876; +4 new). Diagnostics
  (`diagnostic:world`, `diagnostic:npcs`) clean — 0 invariant failures.

### Done in iter 6 (2026-08-26)
- ADDED 4C-8 **workplace-life panel** `EmploymentUI.workplacePanel(world, personId)` — the
  missing 4C-6 presentation surface. Read-only, mirrors the other
  EmploymentUI panels (no World/S mutation; degrades gracefully when the
  backing systems are absent):
  - **Well-being**: workplace stress as a 0–100% bar (green → amber → red
    tones at .5/.7), misconduct strike count `n of 3`, recent safety
    incidents (last 3, labelled Minor/Serious/Severe injury, Strain), and
    leave-reason fallback copy.
  - **Leave state**: when the active contract is `on_leave` it shows the
    leave kind (Burnout/Medical) and start year instead of "At work".
  - **Colleagues**: from `WorkplaceSystem.rosterFor` — senior colleague
    (highest-tier peer, marked ★) plus peer rows with occupation/tier and a
    RelationshipMemory-derived tone (cordial/warm/strained).
  - **Workplace record**: up to 3 most-recent `workplace`-tagged
    relationship memories (bond/conflict summaries, green/red tinted).
  - `peerTone` and `workplaceMemories` intentionally guard on
    `world.relationshipMemories` presence so they never trigger
    RelationshipMemory.ensure's lazy world mutation during a render.
- WIRED `workplacePanel` into `employmentUiPanels()` in `js/ui.js` (personal
  standing view) and bumped `?v=` cache-busters on `employment-ui.js` and
  `ui.js` in `life-game.html`.
- ADDED minimal additive CSS for the panel (`.workplace-panel`, stress bar,
  peer rows, memory rows) in `css/style.css`.
- NEW tests `tests/employment-ui.test.js` (+4): well-being/roster/record
  render from live systems with a no-mutation snapshot check, leave-status
  rendering + empty-person degradation, and absence-only graceful
  degradation. Full suite: **883/883 pass** (was 879; +4 new).
  Diagnostics (`diagnostic:world`, `diagnostic:npcs`) clean — 0 invariant
  failures.

## Next iteration target: 4C-8 follow-ups + legacy-path retirement review

- Evaluate **full retirement of the legacy `rollJobVacancies()` / flat `INC[]`
  income path** (per the phase-page completion criteria): it is now a thin
  delegate that repopulates `S.vacancies` from the persistent
  `VacancySystem` projection, so the player-facing portal (`js/ui.js` job
  ladder) already reads the authorit/ative source. Removing it outright
  risks breaking the `S.vacancies` compatibility projection read by the
  contract-history/hire flows, so treat as a bounded follow-up, not a
  same-iteration swing.
- Then consider small verifiable slices toward finishing 4C-8 and closing out
  Phase 4C, after which the backlog opens Phase 5 (Government/law/politics).

## Lock

`.autopilot.lock` present, age < 20 min — run in progress, per protocol.