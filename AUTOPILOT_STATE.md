# AUTOPILOT STATE — Life Game

**STATUS:** OK  
**Current phase:** Phase 5 — Government / law / politics (slice 2 + player-facing readout complete)  
**Last verified:** 2026-08-26 (iter 12)  
**origin/master SHA:** 454511635a2837d97b67962463b2c25d7e51aecc  (local HEAD is 16+ ahead — iters 1–12 not yet pushed) 

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

3. **Phase 5 — Government / law / politics** ✅▶️ *(slice 1 landed 2026-08-26; slices 2+ remain)*  
   - ✅ `js/systems/government-system.js` — authoritative `World.government` (regime posture: legitimacy / propaganda / surveillancePosture / scrutinyPressure), deterministic annual tick via `streamFor`, idempotent + stale-year rejection, bounded history, invariants, `WorldSimulation.migrate` hook, `advanceYear` wiring.  
   - ⏳ Slice 2+: `js/systems/law-system.js`; Bureau detention / permits / queues as player-facing mechanics; narrative chains (Phase 7) wired to regime posture.  

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

### Done in iter 7 (2026-08-26)
- LIVE JOB PORTAL REFRESH (4C-8 follow-up): `openJobPortal()` in js/ui.js now
  re-pulls the `S.vacancies` compatibility projection from
  `VacancySystem.playerPortalVacancies(World,S)` before rendering (guard
  mirrors `syncPlayerVacancyPortal()`: age 16–65, not jailed). Mid-year
  changes — a vacancy filled/expired/withdrawn or its employer closed — are
  visible the moment the portal opens instead of waiting for the next annual
  sync. Read-only over authoritative records; out-of-band subjects keep the
  previous snapshot behavior.
- Bumped `js/ui.js?v=` cache-buster to `20260826-portal1` in life-game.html.
- NEW tests (+2, in tests/vacancy-ui-integration.test.js): the portal renders
  a vacancy opened mid-year without waiting for the annual sync; the portal
  drops a vacancy withdrawn mid-year without mutating authoritative records
  (statuses before/after identical). Focused file: 66/66. Full suite:
  **885/885 pass** (was 883). Diagnostics (`diagnostic:world`,
  `diagnostic:npcs`) clean — 0 invariant failures.
- Legacy-path verdict: `rollJobVacancies()` stays as the sanctioned single
  refresh point for the compatibility projection (now invoked by BOTH the
  annual sync and portal open); its isolated-execution fallback branch is
  intentionally retained for VacancySystem-less contexts. Flat `INC[]`
  remains a fallback-only salary lookup — full retirement deferred until
  every reader routes through contracts.

## Next iteration target: close out Phase 4C

- Audit remaining readers that could see stale `S.vacancies` or rely on the
  flat `INC[]` fallback and route them through system APIs where cheap;
  then walk the phase-page completion checklist for 4C-6/4C-7/4C-8 to
  declare Phase 4C complete.
- After that, the backlog opens Phase 5 (Government/law/politics).

### Done in iter 8 (2026-08-26)
- LANDED the pending uncommitted ⭐ USER DIRECTIVE (authoritarian-cruelty
  north-star theme) into AUTOPILOT_STATE.md as a standalone section. Repo was
  12 commits ahead of origin/master (iters 1–7 never pushed); committed that
  directive as its own autopilot commit.
- COMPLETED the Phase 4C close-out audit:
  - All three `INC[]` salary readers in js/ui.js (lines 186, 274, 3031) already
    prefer the authoritative contract via `EmploymentSystem.activeForPerson`
    and only fall back to `INC[]` when `World`/the systems are unavailable —
    exactly the documented "fallback-only, never a second live authority"
    state the Phase 4C completion criteria require. `S.vacancies` is already
    re-pulled on `openJobPortal()` (iter 7) so it cannot go stale mid-year.
  - LOCKED the completion criteria with a new focused test file
    `tests/phase4c-invariants.test.js` (+4 tests, full suite now 889 pass, was
    885) driving the REAL multi-year `advanceYear` pipeline:
    1. referential integrity holds across 8 advanced years (every business's
       employeeIds exactly matches its active/on_leave contracts; no person
       holds >1 active contract; no active contract dangles to a missing/
       closed business; Business/Employment/Vacancy checkInvariants all clean);
    2. the three systems' checkInvariants stay clean every year for 5 years;
    3. closing a business drops employeeIds and reconciles its employment
       contracts (all invariants clean after close);
    4. the per-settlement ≤12 cap is *surfaced* by `checkInvariants` (never
       silent) — see finding below.
- FINDING (documented, not fixed — intentional): `BusinessSystem.create()` does
  NOT enforce the per-settlement ≤12 cap; only `seedSettlement`/`checkInvariants`
  guard/flag it. This is deliberate — forcing `create()` to throw would break
  legitimate paths (player founding a 13th business in a small town; NPC
  seeding). `checkInvariants` already reports overflow as a recoverable
  condition, never a crash. Captured by test #4 so the behavior stays observable.
  Left as-is per repo rule 8 (no weakening/over-engineering of correct behavior).
- Full suite: **889/889 pass** (was 885; +4 new). No sim mutations; tests are
  read-only over authoritative state. Diagnostics not required (no sim-system
  changes to World/S schema).
- Verified close-out gate: `npm run diagnostic:world` and `npm run
  diagnostic:npcs` both return **0 invariant failures** (medicalInvariantFailures:
  0, invariantFailures: [] across all sampled years).

## Lock

`.autopilot.lock` present, age < 20 min — run in progress, per protocol.
## ⭐ USER DIRECTIVE (2026-08-26 evening) — AUTHORITARIAN CRUELTY THEME + INTERCONNECTION
North-star direction for all future slices (continue roadmap slices, but shape
them toward this):

1. THEME — living under an authoritarian, cruel government. The player is an
   ordinary person surviving state oppression: surveillance, permits/queues,
   propaganda, informants, rationing, arbitrary detention (Bureau), fear and
   small resistances. Systems should express institutional cruelty through
   MECHANICS (bureaucratic friction, punishment risk, scarcity), not gore.
   Tone: oppressive, Kafkaesque, human — keep it tasteful.
2. INTERCONNECTEDNESS FIRST — new systems must hook into what exists
   (settlement economy, public health, NPC/households, medical, businesses/
   employment/vacancies, relationship memory). Government/law (Phase 5),
   narrative chains (7), property (8) etc. should grow FROM this theme.
3. Every slice keeps deterministic sim rules (streamFor), migrations,
   focused tests + full suite green.

### Done in iter 9 (2026-08-26) — Phase 5 slice 1: Government System foundation
- OPENED **Phase 5 (Government / law / politics)**, the backlog's next item and
  the explicit USER DIRECTIVE target ("grow FROM the authoritarian-cruelty
  theme"). Took the smallest verifiable slice: an authoritative regime-posture
  system, not yet player-facing mechanics.
- NEW `js/systems/government-system.js` (`GovernmentSystem`):
  - Owns `World.government` `{schemaVersion, regime:'bureaucratic_authoritarian',
    legitimacy, propaganda, surveillancePosture, scrutinyPressure, lastTickYear,
    history[]}` — all bounded `[0,1]` matrices per the Engineering-Rules bounded-state
    rule.
  - INTERCONNECTEDNESS-FIRST (per the directive): `computePosture` *reads* the
    existing `settlement.security.surveillance`/`.unrest` and
    `world.nationalModifiers` — it is a downstream expression of the live
    settlement-security sim, never a duplicate authority. It then *writes*
    small bounded amounts to the player's own `S` (scrutiny up on the
    already-watched; freedom down under a weak regime) — exactly the
    StateCareSystem pattern (system owns `World.*`, player oppression is
    expressed through `S`, which other systems already consume). No new
    authoritative fact duplicated in `S`.
  - Deterministic: all rolls via `WorldSimulation.streamFor(world, year,
    'government:…')`; same-seed → identical state; **same-year tick is a
    no-op** (`reason:'already_applied'`); **stale-year rejected**
    (`reason:'stale_year'`) without mutation; history bounded to 32.
  - `migrate`/`ensure` repair malformed records (regime reset, matrices
    clamped, history array healed); `checkInvariants` returns strings and is
    clean on fresh + corrupted + multi-year state.
- WIRED into the pipeline (guarded, follows the StateCare precedent):
  - `WorldSimulation.migrate` now calls `GovernmentSystem.migrate` (alongside
    the other systems).
  - `advanceYear` runs `runGovernmentYearTick()` right after
    `runStateCareYearTick()` — computes posture and, when applicable, logs a
    `ruling` chip (`'REGIME FILE · YEAR N'`) expressing the grip on `S`.
  - `life-game.html`: `js/systems/government-system.js?v=20260826-gov1` loaded
    after `survival-system.js`, before `state-care-system.js`.
- NEW `tests/government-system.test.js` (7 tests): valid/self-healing ensure +
  invariants, `WorldSimulation.migrate` wiring, deterministic + same-year
  idempotency, stale-year rejection, posture-as-expression-of-surveillance,
  bounded subject-grip expression, and a 10-year multi-year invariant/history
  bound check. All drive the live system; none fabricate state.
- Full suite: **896/896 pass** (was 889; +7 new). Diagnostics (`diagnostic:world`,
  `diagnostic:npcs`) clean — `invariantFailures: []`, `medicalInvariantFailures: 0`
  across all sampled years. No World/S schema change beyond adding `World.government`.

## Next iteration target
- Phase 5 slice 3: extend the player-facing surface into *mechanics* — e.g. a
  `law-system.js` stub + Bureau detention / permit / queue decisions wired
  through `GovernmentSystem`'s posture (scrutinyPressure, surveillancePosture).
  Keep deterministic + migration + focused tests + full-suite green.

### Done in iter 12 (2026-08-26) — Phase 5 slice 2: Bureau-attention threat line
- ADDED a derived "BUREAU ATTENTION" threat line to `EmploymentUI.regimePanel`:
  a pure, deterministic function of the slice-1 posture
  (`0.55*surveillancePosture + 0.45*scrutinyPressure`) that expresses the
  authoritarian-cruelty theme as risk the player can read at a glance — LOW /
  ELEVATED / HIGH, each with a distinct tone class. No World/S mutation; reads
  only authoritative posture. First step toward slice 3's mechanic surface
  (the threat line is exactly what a future Bureau-detention decision would
  consult).
- Added additive CSS (`.regime-threat` + mid/high tones) in `css/style.css`.
- NEW focused test in `tests/employment-ui.test.js` (+1): high/low posture →
  HIGH/LOW label + correct tone class. Focused file: 13/13. Full suite:
  **900/900 pass** (was 899; +1).
- Verified gate: `npm run diagnostic:world` + `npm run diagnostic:npcs` clean
  (`invariantFailures: []`, `medicalInvariantFailures: 0`).

### Done in iter 11 (2026-08-26) — Phase 5 slice 2 addendum: posture-history readout
- EXTENDED `EmploymentUI.regimePanel` with a "POSTURE HISTORY" section that
  reads the authoritative `World.government.history` (the bounded 32-entry
  annual-posture log the slice-1 `tickWorld` maintains) — newest 6 entries
  shown first, each as a year stamp + the verbatim posture note. Renders the
  entry count and is omitted entirely when history is empty. Read-only; no
  World/S mutation (covered by the new no-mutation snapshot test).
- Added additive CSS (`.regime-history`, history rows) in `css/style.css`.
- NEW focused test in `tests/employment-ui.test.js` (+1): history readout with
  year + latest-note rendering, entry count, omission when empty, and
  no-mutation. Focused file: 12/12. Full suite: **899/899 pass** (was 898; +1).
- Verified gate: `npm run diagnostic:world` and `npm run diagnostic:npcs` clean
  (`invariantFailures: []`, `medicalInvariantFailures: 0`).

### Done in iter 10 (2026-08-26) — Phase 5 slice 2: regime-posture readout panel
- TURNED the Phase 5 slice-1 posture into the project's first *player-facing*
  authoritarian-cruelty surface, per the ⭐ USER DIRECTIVE.
- NEW `EmploymentUI.regimePanel(world, options)` (presentation-only, read-only,
  mirrors the other EmploymentUI panels; degrades to a friendly unavailable
  panel when `GovernmentSystem` is absent):
  - Reads the authoritative `World.government` aggregate via `GovernmentSystem.summary`
    (never duplicates state) and renders four bounded `0–1` posture bars —
    Legitimacy, Propaganda, Surveillance, Scrutiny pressure — plus the live
    `summaryLabel` ("REGIME · TIGHTENING GRIP" etc.).
  - When the player's `S` is present it appends a "YOUR FILE" section reading
    `S.scrutiny` / `S.freedom` (the regime grip already expressed by the slice-1
    annual tick), so the oppression the sim computes is visible in one place.
  - Color tones: low (blue/green) → mid (amber) → high (red) for posture/high
    bars; freedom uses the low (green) tone to read as "remaining liberty".
  - No mutation of World/S (verified by a before/after JSON snapshot test).
- WIRED `regimePanel` into `employmentUiPanels()` in `js/ui.js` (personal
  standing view) and bumped `js/ui/employment-ui.js?v=` to `20260826-gov2` in
  `life-game.html`. Added additive CSS (`.regime-panel`, bars, file section) in
  `css/style.css`.
- NEW focused tests in `tests/employment-ui.test.js` (+2): live posture + S-file
  readout with no-mutation snapshot check and weak-regime label; posture-only
  render when `S` absent; graceful degradation when `GovernmentSystem` is
  absent. Focused file: 11/11. Full suite: **898/898 pass** (was 896; +2 new).
- Verified gate: `npm run diagnostic:world` and `npm run diagnostic:npcs` both
  clean — `invariantFailures: []`, `medicalInvariantFailures: 0`.
