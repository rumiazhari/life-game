# Phase 4C — Businesses and Employment

- **Phase objective:** give persistent settlements a real economy of
  discrete businesses and give persistent people (player and NPCs) real
  employment relationships with those businesses — replacing the legacy
  flat-income/random-vacancy model — so that later phases (property,
  inheritance, national history) have real employers and workplaces to hang
  off of.
- **Live status:** IN PROGRESS. Slices 4C-1 through 4C-5 are IMPLEMENTED
  ON BRANCH. Slices 4C-6 through 4C-8 are PLANNED.
- **Verified branch:** `agent/phase-4c1-business-foundation`
- **Verified implementation baseline:** `c1d28f83fdea036b4caacfcaab1f1010da5e3922`
  ("Finish persistent employment transition coverage") — the commit reviewed
  when this page was last written, not necessarily the branch's current
  head. Run `git rev-parse origin/agent/phase-4c1-business-foundation` for
  the live head.
- **Current pull request:** [PR #9](https://github.com/rumiazhari/life-game/pull/9),
  base `master`, head `agent/phase-4c1-business-foundation`, open and under
  review.
- **Merged vs. branch-only:** none of Phase 4C is on `origin/master`
  (`2d5b89d`) yet. Everything described as "implemented" below is
  IMPLEMENTED ON BRANCH only, pending review and merge of PR #9.
- **Dependencies:** Phase 3 (`World.npcs`, `World.households` — employment
  contracts reference `personId`s from this registry); Phase 2
  (`WorldSimulation.streamFor`, `WorldSimulation.getSettlementState` —
  business finance reads settlement runtime and uses the settlement's
  deterministic stream family); `js/data.js`'s `CAREERS`/`JOBLIST`/`INC` as
  read-only legacy reference data for reconciliation.
- **Completion criteria for the whole phase:** see the end of this page.

## 4C-1 — Persistent business registry

**Status: IMPLEMENTED ON BRANCH**, verified in `js/systems/business-system.js`.

State, as implemented:

```
World.businesses            // { [businessId]: BusinessRecord }
World.businessCounter       // integer, monotonic ID allocator
World.businessSchemaVersion // integer
```

`BusinessRecord` shape, as implemented:

```
{
  id,                  // "business:00001" — stable, never reused
  name,
  settlementId,
  sector,              // one of BusinessSystem.SECTORS
  demandGroup,         // derived from sector, matches SettlementEconomy.industryDemand keys
  kind,                // 'private' | 'cooperative' | 'public' | 'nonprofit'
  status,              // 'active' | 'struggling' | 'closed'
  foundedYear,          // bounded integer or null
  ownerNpcId,           // present in schema; never set by any system yet (see 4C-7)
  employeeIds,          // array of personId, synchronized from EmploymentSystem
  vacancies,            // array of open vacancy:NNNNN IDs, synchronized from
                         // VacancySystem.syncBusinessVacancyIds (see 4C-4);
                         // authoritative vacancy records live in World.vacancies
  finances: {cash, debt, revenue, expenses, payroll, profit, lastYear},
  lastTickYear,
  strugglingYears,
  closedYear,
  history               // bounded array, newest 48 entries
}
```

Implemented API (`root.BusinessSystem`):

```
ensure, migrate, create, get, all, forSettlement, seedSettlement, seedWorld,
summary, checkInvariants, financeInputs, calculateAnnualResult, tickBusiness,
tickSettlement, tickWorld, close
SECTORS, SCHEMA_VERSION, MAX_BUSINESSES_PER_SETTLEMENT
```

Confirmed behavior: deterministic per-settlement seeding
(`seedSettlement`/`seedWorld`, target business count by population tier, up
to `MAX_BUSINESSES_PER_SETTLEMENT` = 12); ID migration hardening following
the algorithm in
[Engineering Rules](ENGINEERING-RULES.md#stable-identity); bounded,
integer-normalized money and year fields; `checkInvariants` covering ID
uniqueness/format, sector/kind/status validity, employee-ID uniqueness,
finance field bounds, tick-year/`finances.lastYear` synchronization, and
closed-business employee/vacancy emptiness. Tests: `tests/business-system.test.js`.

## 4C-2 — Persistent employment contracts

**Status: IMPLEMENTED ON BRANCH**, verified in
`js/systems/employment-system.js`. This slice's original scope (contract
CRUD, employer selection, legacy reconciliation) is unchanged; 4C-5 below
substantially expanded `EmploymentSystem`'s API with the vacancy-backed
hiring/promotion/lifecycle surface, which now also lives in this file.

State, as implemented:

```
World.employmentContracts        // { [contractId]: ContractRecord }
World.employmentContractCounter  // integer, monotonic ID allocator
World.employmentSchemaVersion    // integer
S.employmentContractId           // stable pointer on the legacy player state, not a duplicate record
```

`ContractRecord` shape, as implemented (schema version 2):

```
{
  id,                // "employment:00001" — stable, never reused
  personId,          // 'subject' for the player, otherwise an NPC id
  workerType,        // 'player' | 'npc', derived from personId
  businessId,
  settlementId,      // must match businessId's settlementId
  occupationType,    // 'career' | 'job' | 'generic'
  occupationId,
  occupationName,
  careerStage,       // bounded non-negative integer or null
  jobTier,           // bounded integer 0–5
  annualSalary,      // bounded non-negative number, MAX_SALARY = 5,000,000
  hiredYear,          // bounded integer
  endedYear,          // bounded integer or null; always >= hiredYear when set
  status,            // 'active' | 'on_leave' | 'terminated' | 'resigned' | 'retired'
  terminationReason,
  origin,            // 'legacy' | 'vacancy' — 'vacancy' only when hired/promoted
                      // through a real VacancySystem opening; a vacancy-origin
                      // contract's salary/name/stage are authoritative and are
                      // never overwritten by legacy-descriptor reconciliation
  stageStartedYear,   // year the current career stage began, >= hiredYear;
                      // drives tenure/career-years qualification checks
  lastReviewYear, lastLifecycleYear, lastPromotionAttemptYear, // lifecycle bookkeeping
  vacancyAssignments, // bounded array (max 8), immutable snapshots of
                      // {vacancyId,year,businessId,occupationType,occupationId,
                      // occupationName,careerStage,jobTier,annualSalary} recorded
                      // on every vacancy fill/promotion — lets a filled vacancy
                      // still be referentially verified against the contract
                      // after later promotions (see 4C-4/4C-5)
  performance,        // [0,1]
  satisfaction,       // [0,1]
  lastPaidYear,       // bounded integer or null
  annualPaid,         // bounded non-negative number
  history             // bounded array, newest 64 entries
}
```

Implemented API (`root.EmploymentSystem`):

```
ensure, migrate, create, get, all, forPerson, forBusiness, activeForPerson,
activeForBusiness, hire, end, payBusinessPayroll, syncBusinessEmployees,
syncAllBusinessEmployees, reconcilePerson, reconcilePlayer, reconcileNpcs,
summary, checkInvariants, sectorsForCareer, sectorForJobName, normalizedJobSlug,
recordVacancyAssignment, contractHasVacancyAssignment, syncPersonLegacy,
syncPlayerLegacy, syncNpcLegacy, acceptVacancy, promote, adjustSalary,
dismiss, resign, retire, requestPromotion, considerAutomaticPromotion, tickWorld
SCHEMA_VERSION, CONTRACT_STATUSES, WORKER_TYPES, CONTRACT_ORIGINS
```

The `acceptVacancy`/`promote`/`adjustSalary`/`dismiss`/`resign`/`retire`/
`requestPromotion`/`considerAutomaticPromotion`/`tickWorld` exports and the
`origin`/`stageStartedYear`/lifecycle-review/`vacancyAssignments` fields
above were added by 4C-5 (see that section for full behavior) — they are
listed here because they live in the same `ContractRecord`/`EmploymentSystem`
surface as the original 4C-2 scope.

Confirmed behavior:

- **At most one active/on_leave contract per person**, enforced at
  `create()` (public API is invariant-safe on its own, not only through
  later migration repair), and by `checkInvariants`.
- **Deterministic employer selection** (`chooseEmployer`/
  `resolveExistingEmployer`, private helpers): prefers an existing
  sector-compatible open business in the target settlement, chosen by a
  deterministic hash of `(world.seed, personId, occupationType,
  occupationId)`; otherwise creates or reuses one deterministic named
  fallback business per settlement per primary sector (e.g. "Oberhain
  Healthcare Placement Office"). This resolution is **capacity-aware**:
  employer search only considers open businesses; the decision to create a
  new fallback business only considers whether the settlement's **total**
  business count (open + closed) is below
  `BusinessSystem.MAX_BUSINESSES_PER_SETTLEMENT`; at capacity with open but
  incompatible businesses it falls back to one deterministic stable open
  business (lowest ID) without annual churn; at capacity with every
  business closed it returns no employer rather than exceeding the cap or
  assigning a closed business. Compatibility evaluation itself
  (`isContractCompatible`) never creates a business as a side effect — it
  shares the same pure existing-employer lookup that employer selection
  uses.
- **Reconciliation transfer logic**: `reconcilePerson` keeps an existing
  contract only when settlement, occupation type/identity, business
  openness, and business-sector compatibility all still hold; otherwise it
  ends the old contract with a specific reason (`worker_relocated` or
  `employment_changed`) and hires into a freshly resolved employer, never
  leaving more than one active contract.
- **Legacy reconciliation**: `reconcilePlayer(world, subject)` reads the
  legacy `S.career`/`S.jobTier`/`S.jobName` fields (read-only) and
  reconciles them into a contract, writing back only
  `S.employmentContractId`; `reconcileNpcs(world)` does the same from each
  NPC's `employment.{status,sector,careerId,income}` snapshot fields.
- **Payroll**: `payBusinessPayroll` pays every active/on_leave contract at
  a business, using per-contract-bounded, saturating-accumulated totals
  (never `Infinity`/`NaN` even from malformed saved salaries), and is
  idempotent within a year.
- Tests: `tests/employment-system.test.js`, `tests/employment-lifecycle.test.js`.

## 4C-3 — Annual business finance

**Status: IMPLEMENTED ON BRANCH**, verified in
`js/systems/business-system.js` (`financeInputs`, `calculateAnnualResult`,
`tickBusiness`, `tickSettlement`, `tickWorld`, `close`) and the
`runBusinessYearTick()` wrapper wired into `advanceYear()` in `js/ui.js`.

Confirmed behavior: `financeInputs` reads clamped/bounded settlement runtime
(employment index, sector demand, unrest, checkpoint pressure, public-health
pressure, wage/rent/food-price indexes bounded to
`SettlementEconomy.MIN_INDEX..MAX_INDEX`, population, active employee count,
saturating-bounded payroll); `calculateAnnualResult` draws exactly one
deterministic variation value per business per year from
`WorldSimulation.streamFor(world, year, business.id, 'business-finance')`
(never the shared `Random`/`chance()`); computes bounded revenue, expenses,
profit, and updates cash/debt with profit-based debt repayment (up to 35%
of profit) or loss absorbed by cash-then-debt; `tickBusiness` is same-year
idempotent (`{applied:false, reason:'already_applied'}`) and rejects stale
years (`reason:'stale_year'`); a business becomes `'struggling'` on a loss
year or excess debt, resets to `'active'` on recovery, and closes via
`close()` after 3+ struggling years plus a debt/cash threshold; `close()`
terminates all active contracts at the business
(`EmploymentSystem.end(..., 'terminated', 'business_closed', ...)`), clears
`employeeIds`/`vacancies`, and is idempotent-repairing even on an
already-closed malformed record (never appends a duplicate closure history
entry). `tickWorld` runs `BusinessSystem.migrate`/`EmploymentSystem.migrate`
first, then ticks every business in stable ID order, then resynchronizes
employees. Tests: `tests/business-finance.test.js`.

## 4C-4 — Real employer-generated vacancies

**Status: IMPLEMENTED ON BRANCH**, verified in `js/systems/vacancy-system.js`.

State, as implemented (a dedicated top-level collection with its own stable
ID space, not embedded objects — see below):

```
World.vacancies            // { [vacancyId]: VacancyRecord }
World.vacancyCounter       // integer, monotonic ID allocator
World.vacancySchemaVersion // integer (currently 1)
World.vacancyLastTickYear  // bounded integer or null — annual-tick idempotency guard
```

`VacancyRecord` shape, as implemented:

```
{
  id,                // "vacancy:00001" — stable, never reused, /^vacancy:\d{5,}$/
  businessId,
  settlementId,
  occupationType,    // 'career' | 'job' | 'generic'
  occupationId,
  occupationName,
  careerStage,       // bounded non-negative integer or null
  jobTier,           // bounded integer 1–5
  annualSalary,      // bounded non-negative number
  requirements,      // {minAge, educationStage, majorIds, skills, minCareerYears}
  openedYear,
  expiresYear,       // defaults to openedYear + 2
  status,            // 'open' | 'filled' | 'expired' | 'withdrawn'
  filledByPersonId,
  filledContractId,
  filledYear,
  closedReason,
  applications,      // bounded array (max 12), each {personId,workerType,kind,
                      // appliedYear,score,status,resolvedYear,reason}
  history            // bounded array
}
```

Implemented API (`root.VacancySystem`):

```
ensure, migrate, create, get, all, forBusiness, forSettlement, openVacancies,
open, withdraw, expire, withdrawForBusiness, syncBusinessVacancyIds,
syncAllBusinessVacancyIds, targetWorkers, candidateTemplates,
generateForBusiness, tickWorld, summary, checkInvariants, qualifies,
qualificationDetails, rankApplicant, applicationsForPersonInYear,
submitApplication, seedNpcApplications, resolveVacancy, resolvePending,
applyAndResolve, playerPortalVacancies
SCHEMA_VERSION, VACANCY_STATUSES, APPLICATION_STATUSES, APPLICATION_KINDS,
MAX_APPLICATIONS_PER_VACANCY, MAX_OPEN_PER_BUSINESS, MAX_OPEN_PER_SETTLEMENT,
MAX_NPC_APPLICANTS_PER_VACANCY, MAX_APPLICATIONS_PER_PERSON_PER_YEAR
```

Confirmed behavior:

- **`business.vacancies` holds only open-vacancy-ID string references**,
  never embedded objects — `syncBusinessVacancyIds`/`syncAllBusinessVacancyIds`
  always rewrite it to the sorted list of that business's open vacancy IDs.
  Authoritative vacancy state lives entirely in `World.vacancies`.
- **Migration and placeholder repair**: `migrate()` reconciles top-level
  `World.vacancies` records against any legacy-shaped embedded
  `business.vacancies` entries from old saves (full objects or dangling
  string IDs), repairing malformed, duplicate, or cross-business-referenced
  entries into `withdrawn` placeholders (`closedReason` such as
  `migration_duplicate_reference`, `migration_cross_business_reference`,
  `migration_invalid_record`) that preserve the original input rather than
  silently discarding it. An embedded record's explicit `businessId`
  contradicting its containing business is checked unconditionally — before
  any top-level-ID or used-ID handling — so a mismatch can never be silently
  treated as legitimate; the same strict-ownership rule applies to embedded
  string references.
- **Deterministic employer vacancy generation** (`generateForBusiness`/
  `targetWorkers`): a business's target workforce is derived from its
  finance-inputs scale (~1 + 4×scale), adjusted by sector demand and last
  year's profit sign, clamped to [1,8] (public/nonprofit businesses floor at
  2, closed businesses target 0); `generateForBusiness` opens vacancies for
  the gap between target and current employees+open vacancies, capped by
  `MAX_OPEN_PER_BUSINESS`/`MAX_OPEN_PER_SETTLEMENT`, skipping closed or
  struggling-and-losing-money businesses. Each generated vacancy's role
  template is picked deterministically via
  `Random.hashSeed(seed|year|businessId|'vacancy-template'|slotIndex)`.
- **Sector-to-template mapping**: a `SECTOR_CAREERS` table maps each
  business sector to `CAREERS` track IDs (expanded into per-stage role
  templates with the track's own requirements/tier/salary), and a keyword
  match against `JOBLIST` supplies non-career job templates; `jobTier` is
  capped by a scale derived from the business's finance scale and profit
  sign.
- **Expiry and withdrawal**: `expire()` closes an open vacancy once
  `year > expiresYear`, rejecting pending applications with reason
  `vacancy_expired`; `withdraw()`/`withdrawForBusiness()` perform manual/
  forced closes (e.g. `missing_business`, `business_closed`) and reject
  pending applications with the withdrawal reason. A closed business never
  carries open vacancies — `BusinessSystem.close()` already clears
  `vacancies`, and `tickWorld` withdraws any open vacancy whose business is
  missing or closed before generating new ones.
- **Caps**: `MAX_OPEN_PER_BUSINESS = 3`, `MAX_OPEN_PER_SETTLEMENT = 24`,
  enforced in `open()` (throws) and `generateForBusiness` (silently clamps),
  and validated by `checkInvariants`.
- **`tickWorld`** is the annual idempotent entry point: migrates, then
  expires/withdraws stale or orphaned open vacancies, then generates new
  ones per business, then resyncs `business.vacancies`; guarded by
  `World.vacancyLastTickYear` against same-year re-application and
  earlier-year (stale) calls.
- **`playerPortalVacancies(world, subject)`** is the compatibility
  projection consumed by the player-facing job portal — every open vacancy
  in the player's settlement where the player is age 16–64 and the employer
  isn't closed, one entry per opening (no collapsing by career track), each
  carrying live `qualificationDetails` and the player's own application
  status for that vacancy. `S.vacancies` (the legacy UI array) is populated
  from this projection, not from an independent random roll — see the
  [Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md) and
  [Repository Architecture](REPOSITORY-ARCHITECTURE.md#authoritative-state).

Tests: `tests/vacancy-system.test.js`, `tests/vacancy-ui-integration.test.js`.

## 4C-5 — Hiring and career lifecycle

**Status: IMPLEMENTED ON BRANCH**, verified in `js/systems/employment-system.js`
and `js/systems/vacancy-system.js`, wired into the player-facing actions in
`js/data.js`/`js/ui.js`.

Confirmed behavior:

- **Qualification and ranking**: `VacancySystem.qualificationDetails`
  evaluates age, education stage/rank, major, skills, career-years tenure,
  and career-stage progression against a vacancy's `requirements`, returning
  a `reasons[]` breakdown; `rankApplicant` scores a qualified applicant 0–100
  from qualification strength, experience, performance, relationship, and
  reputation components plus deterministic per-candidate noise
  (`WorldSimulation.streamFor`-derived, never the shared `Random`).
- **Application seeding**: `seedNpcApplications` deterministically ranks and
  submits applications for up to `MAX_NPC_APPLICANTS_PER_VACANCY` eligible
  NPCs per vacancy each year (called from the annual vacancy tick); player
  applications are user-driven through the `lookwork`/`favor`/`presspromo`
  actions calling `VacancySystem.applyAndResolve`/
  `EmploymentSystem.requestPromotion` directly — there is no automatic
  player-side seeding.
- **Hiring and employer switching**: `EmploymentSystem.acceptVacancy` either
  promotes in place (same business, next career stage — see below) or, for
  a genuine switch, ends the previous active contract (`resigned`, reason
  `accepted_new_position`) and hires a brand-new `origin:'vacancy'` contract
  at the new employer.
- **Internal promotion retains the same contract ID**: `promote()` mutates
  the existing contract's `occupationName`/`careerStage`/`jobTier`/
  `annualSalary`/`stageStartedYear` in place — it never creates a new
  contract — and records the fill via `recordVacancyAssignment`. This
  applies to both NPC and player promotions.
- **Salary adjustment**: `adjustSalary` mutates `annualSalary` on the
  contract and logs a `salary_adjusted` history entry; it does not itself
  move player cash — see "contract salary as income authority" below.
- **Resignation, dismissal, layoffs, closure, retirement, early
  retirement**: `resign()`/`dismiss()`/`retire()` are thin wrappers over a
  shared terminal-transition helper (`end`), each setting a distinct
  `terminationReason`. Business-driven layoffs run inside
  `EmploymentSystem.tickWorld` for every `struggling` business with more
  than one active contract, ranking employees by risk (inverse performance,
  salary share, inverse satisfaction, deterministic noise) and dismissing
  with reason `layoff_financial`. Business closure force-terminates any
  active contract at a missing/closed business during migration. Automatic
  age-65 retirement (player and NPC) runs inside the same `tickWorld`. The
  player-facing `earlyret` action calls `EmploymentSystem.retire(...,
  {reason:'early_retirement', terminalJobName:'Pensioner (early)'})`
  directly, ending the contract as `retired`/`early_retirement` rather than
  leaving it dangling to be misclassified later. Forced job-loss paths
  (Bureau detention, incarceration from the serious-crime follow-up) also
  route through a shared helper that calls `EmploymentSystem.dismiss` with a
  specific reason (`bureau_detention`, `incarceration`) rather than directly
  clearing `S` fields.
- **`employmentLifecycleLastTickYear` idempotency**: `EmploymentSystem.tickWorld`
  short-circuits with `{applied:false, reason:'already_applied'}` if called
  again for the same year, or `{reason:'stale_year'}` for an earlier year.
- **Player and NPC legacy synchronization**: `syncPersonLegacy` dispatches
  to player/NPC outward sync (including a dedicated retired-state sync that
  accepts a custom terminal job title); `reconcilePlayer`/`reconcileNpcs`
  perform the inward direction, reading legacy `S`/`npc.employment` fields
  and reconciling them into (or terminating) a contract each year.
- **Contract salary is the player income authority**: for an `origin:'vacancy'`
  contract, `reconcilePerson` never overwrites its salary, name, or stage
  from the legacy descriptor — only `origin:'legacy'` contracts still take
  updates from the `CAREERS`/`INC`-derived descriptor. Actual player cash
  payment happens exactly once per year, in `runEconomy` — see the
  [Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md).
- **Real employer-backed job portal**: the `lookwork` action applies through
  `VacancySystem.applyAndResolve` against a real vacancy and reports
  concrete failure reasons (`annual_application_cap`, `vacancy_full`,
  `vacancy_unavailable`, `better_candidate`, `qualification`,
  `duplicate_application`) with status-accurate text for a duplicate
  application (pending/accepted/rejected/withdrawn) rather than a single
  generic message; `presspromo` delegates to
  `EmploymentSystem.requestPromotion`; `quitjob` calls
  `EmploymentSystem.resign`; the "call in a favor" action hires an
  unemployed player through a real qualifying vacancy via
  `VacancySystem.playerPortalVacancies` + `applyAndResolve`, reporting
  `no_opening` when none exists, instead of directly assigning a synthetic
  job tier. Direct `S` mutation remains only as a fallback for the case
  where `VacancySystem`/`EmploymentSystem`/`World` are genuinely
  unavailable.
- **Migration and referential-integrity hardening**: `EmploymentSystem.migrate`
  terminates orphaned contracts (missing/closed business) and resolves
  duplicate active contracts before resyncing business employee lists; a
  filled vacancy's `filledContractId` is verified against the contract's
  `vacancyAssignments` history so a later promotion doesn't silently break
  the vacancy→contract link.

Must integrate with, not duplicate, the existing `CAREERS`/`JOBLIST`
career-stage qualification logic in `js/data.js` — confirmed: `VacancySystem`
reads `CAREERS`/`CAREER_MAJOR_REQUIREMENTS`/`JOBLIST` as read-only reference
data rather than reimplementing a parallel table.

Tests: `tests/employment-lifecycle.test.js`, `tests/vacancy-system.test.js`,
`tests/vacancy-ui-integration.test.js`.

## 4C-6 — Workplace life

**Status: PLANNED.**

Planned: supervisors, coworkers, stress, safety, misconduct, leave,
workplace injury, interpersonal conflicts, professional relationships,
performance reviews, medical leave (feeding `ContractRecord.status =
'on_leave'`, which already exists in the schema).

Must use `RelationshipMemory` (Phase 3) for any person-to-person
relationship state — do not create a second, duplicate relationship-tracking
structure for coworkers.

## 4C-7 — Ownership and entrepreneurship

**Status: PLANNED.**

Planned: ownership shares, starting a new business, investment, dividends,
ownership transfer, sale, inheritance (feeds Phase 9 estate settlement),
voluntary closure, business loans (blocked on Phase 8's credit system).
`BusinessRecord.ownerNpcId` already exists in the 4C-1 schema as a single
optional field; a real ownership model (shares, multiple owners) is a
schema extension, not yet designed in detail. Explicitly out of scope:
turning the game into a full business-management simulator — ownership
mechanics should stay at the scope of "who benefits/is liable," not a
detailed operations-management minigame.

## 4C-8 — UI and legacy retirement

**Status: PLANNED.**

Planned: an employer panel (business status, finances summary, employee
list), contract history view, a vacancy-browsing/application UI backed by
4C-4/4C-5, workplace-relationship UI (4C-6), ownership decision UI (4C-7).
This slice is also where the legacy `rollJobVacancies()`/flat `INC[]`-based
income path gets fully retired once the persistent path covers everything
it did.

## Completion criteria (whole phase)

- Every employed persistent person (player or NPC) has exactly one valid
  active/on_leave employment contract. **True as of 4C-1..5.**
- Every open contract references a business that exists and is not closed.
  **True as of 4C-1..5.**
- Every business's `employeeIds` exactly matches its active/on_leave
  contracts. **True as of 4C-1..5; must remain true through 4C-6..8.**
- The vacancy UI is backed by real, persistent vacancy records rather than a
  random roll. **True as of 4C-4/4C-5** (`S.vacancies` is a compatibility
  projection over `VacancySystem.playerPortalVacancies`); 4C-8 still needs to
  add a full employer-browsing panel beyond the existing portal.
- Layoffs and business closures always correctly reconcile contracts.
  **True as of 4C-5** (layoffs) and 4C-3 (closure via `close()`).
- The player's salary is paid exactly once per year, through exactly one
  authoritative path. **True as of 4C-5** — `origin:'vacancy'` contract
  salary is never overwritten by legacy reconciliation, and `runEconomy` is
  the sole cash-payment call site; re-verify this still holds once 4C-6..8
  add new player-facing systems.
- Obsolete random-vacancy/legacy-payment code paths are either removed or
  clearly documented as intentionally still in use, never silently
  duplicated. **Largely true as of 4C-4/4C-5** — the remaining direct-`S`-
  mutation branches in `js/data.js`/`js/ui.js` are explicitly documented
  fallbacks that only run when `VacancySystem`/`EmploymentSystem`/`World`
  are unavailable, not a second live authority.
- `BusinessSystem.checkInvariants`/`EmploymentSystem.checkInvariants`/
  `VacancySystem.checkInvariants` remain clean (`[]`) after every migration
  and every annual tick, including fast-forwarded multi-year sequences.
  **Verified locally as of the implementation baseline** — re-run before
  trusting.

Phase 4C is not complete until 4C-6 through 4C-8 also satisfy the criteria
above where applicable (workplace relationships, ownership, and UI do not
yet exist).
