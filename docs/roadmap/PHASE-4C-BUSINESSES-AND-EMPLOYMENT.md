# Phase 4C — Businesses and Employment

- **Phase objective:** give persistent settlements a real economy of
  discrete businesses and give persistent people (player and NPCs) real
  employment relationships with those businesses — replacing the legacy
  flat-income/random-vacancy model — so that later phases (property,
  inheritance, national history) have real employers and workplaces to hang
  off of.
- **Live status:** IN PROGRESS. Slices 4C-1, 4C-2, and 4C-3 are IMPLEMENTED
  ON BRANCH. Slices 4C-4 through 4C-8 are PLANNED.
- **Verified branch:** `agent/phase-4c1-business-foundation`
- **Verified commit:** `98c14b6311a2532b1d6538988cf3542c06b7e7cb`
- **Merged vs. branch-only:** none of Phase 4C is on `origin/master`
  (`2d5b89d`) yet. Everything described as "implemented" below is
  IMPLEMENTED ON BRANCH only.
- **Dependencies:** Phase 3 (`World.npcs`, `World.households` — employment
  contracts reference `personId`s from this registry); Phase 2
  (`WorldSimulation.streamFor`, `WorldSimulation.getSettlementState` —
  business finance reads settlement runtime and uses the settlement's
  deterministic stream family); `js/data.js`'s `CAREERS`/`JOBLIST`/`INC` as
  read-only legacy reference data for reconciliation.
- **Completion criteria for the whole phase:** see the end of this page.

## 4C-1 — Persistent business registry

**Status: IMPLEMENTED ON BRANCH**, verified in `js/systems/business-system.js`
@ `98c14b6`.

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
  vacancies,            // array; schema exists but no generator populates it yet (see 4C-4)
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
closed-business employee/vacancy emptiness. Tests: `tests/business-system.test.js`
(51 tests as of `98c14b6`).

## 4C-2 — Persistent employment contracts

**Status: IMPLEMENTED ON BRANCH**, verified in
`js/systems/employment-system.js` @ `98c14b6`.

State, as implemented:

```
World.employmentContracts        // { [contractId]: ContractRecord }
World.employmentContractCounter  // integer, monotonic ID allocator
World.employmentSchemaVersion    // integer
S.employmentContractId           // stable pointer on the legacy player state, not a duplicate record
```

`ContractRecord` shape, as implemented:

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
summary, checkInvariants
SCHEMA_VERSION, CONTRACT_STATUSES, WORKER_TYPES
```

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
- Tests: `tests/employment-system.test.js` (60 tests as of `98c14b6`).

## 4C-3 — Annual business finance

**Status: IMPLEMENTED ON BRANCH**, verified in
`js/systems/business-system.js` (`financeInputs`, `calculateAnnualResult`,
`tickBusiness`, `tickSettlement`, `tickWorld`, `close`) and the
`runBusinessYearTick()` wrapper wired into `advanceYear()` in `js/ui.js`
@ `98c14b6`.

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
employees. Tests: `tests/business-finance.test.js` (33 tests as of
`98c14b6`).

## 4C-4 — Real employer-generated vacancies

**Status: PLANNED.** Nothing below exists yet.

Planned vacancy shape (`business.vacancies[]`, or a new top-level
`World.vacancies` collection — decide during implementation based on
whether vacancies need their own stable cross-business ID space):

```
// PLANNED — none of these fields are populated by any system yet.
{
  id,                // "vacancy:00001"
  businessId,
  settlementId,
  occupationType,
  occupationId,
  occupationName,
  careerStage,
  jobTier,
  annualSalary,
  requirements,      // e.g. skill/education thresholds, mirrors JOBLIST/CAREERS req shape
  openedYear,
  expiresYear,
  status,            // 'open' | 'filled' | 'expired' | 'withdrawn'
  filledByPersonId,
  filledYear
}
```

Planned APIs on `BusinessSystem` or a new `VacancySystem`:

```
openVacancy(world, spec)
closeVacancy(world, vacancyId, reason, year)
fillVacancy(world, vacancyId, personId, year)
openVacancies(world, options)
qualifies(world, personId, vacancy)
rankApplicant(world, personId, vacancy)
```

Design notes:

- vacancy demand should come from a business's target-worker count (some
  function of sector/scale/settlement demand, mirroring
  `businessScaleFor` in `business-system.js`) minus its current
  `activeForBusiness` count — i.e. profitable/growing businesses open
  vacancies, and a business that just lost a worker to termination/layoff
  can reopen one;
- a closed business must never carry open vacancies (`close()` already
  clears `vacancies`; the generator must not reopen them post-closure);
- vacancy counts must be bounded per business and per settlement;
- vacancy creation must be deterministic (`WorldSimulation.streamFor`
  scoped per business, per
  [Engineering Rules](ENGINEERING-RULES.md#deterministic-annual-simulation));
- the existing player-facing vacancy UI (`S.vacancies`,
  `rollJobVacancies()` in `js/ui.js`/`js/data.js`) needs an adapter that
  presents real `BusinessSystem`/vacancy records instead of the current
  random roll, per
  [Engineering Rules](ENGINEERING-RULES.md#compatibility) — replace or
  clearly document as still-legacy-authoritative, not both silently paying
  out.

## 4C-5 — Hiring and career lifecycle

**Status: PLANNED.**

Planned mechanics: application, deterministic applicant scoring (skills,
education, tenure, performance), hiring from a vacancy (creates an
`EmploymentSystem` contract via the existing `create`/`hire` API), promotion
(salary/`jobTier`/`careerStage` change while retaining the same contract —
`reconcilePerson`'s existing "promotion keeps the contract" behavior is the
template), salary adjustment, dismissal, layoffs (business-initiated
termination, distinct reason from voluntary resignation), resignation,
retirement, NPC-vs-NPC/NPC-vs-player competition for the same vacancy with
bounded applicant pools and deterministic tie-breaking (same hash-based
approach `chooseEmployer` already uses).

Must integrate with, not duplicate, the existing `CAREERS`/`JOBLIST`
career-stage qualification logic in `js/data.js` and the legacy vacancy UI
`rollJobVacancies()`/`S.vacancies` — see
[Engineering Rules](ENGINEERING-RULES.md#compatibility).

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
  active/on_leave employment contract.
- Every open contract references a business that exists and is not closed.
- Every business's `employeeIds` exactly matches its active/on_leave
  contracts (already true for 4C-1..3; must remain true through 4C-4..8).
- The vacancy UI is backed by real, persistent vacancy records rather than
  the random roll (4C-4/4C-8).
- Layoffs and business closures always correctly reconcile contracts
  (already true for closure via `close()`; must extend to layoffs in 4C-5).
- The player's salary is paid exactly once per year, through exactly one
  authoritative path — no duplicate legacy-flat-income and
  contract-salary payment simultaneously once 4C-8 retires the legacy path.
- Obsolete random-vacancy/legacy-payment code paths are either removed or
  clearly documented as intentionally still in use, never silently
  duplicated.
- `BusinessSystem.checkInvariants`/`EmploymentSystem.checkInvariants` remain
  clean (`[]`) after every migration and every annual tick, including
  fast-forwarded multi-year sequences.
