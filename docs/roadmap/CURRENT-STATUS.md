# Current Status

**Last verified date:** 2026-08-05
**Verified `origin/master` SHA:** `2d5b89d40068bb6d7747337feb48c54c75232dbc` ("Add complete household health gameplay (#8)")
**Verified active development branch:** `agent/phase-4c1-business-foundation`
**Verified development branch HEAD:** `98c14b6311a2532b1d6538988cf3542c06b7e7cb` ("Fix fallback employer capacity handling")
**Working status source:** `git fetch origin` + `git rev-parse` against `origin/master` and `origin/agent/phase-4c1-business-foundation`, plus direct inspection of `js/systems/business-system.js` and `js/systems/employment-system.js` on that branch.
**Documentation version:** 1 (initial publication)

> This page is a snapshot. Before acting on it, re-run the verification
> commands in [AI-HANDOFF-PROTOCOL.md](AI-HANDOFF-PROTOCOL.md) — the branch
> may have advanced since this page was written.

## Status table

| Area | Status | Branch/commit | Evidence | Remaining work |
|---|---|---|---|---|
| Phase 1 — Core stability | MERGED | `origin/master` @ `2d5b89d` (and earlier) | `js/core/random.js`, `js/core/year-engine.js`, `js/core/effects.js`, `js/core/invariants.js` exist and are exercised by `tests/core.test.js`, `tests/invariants.test.js` | None tracked |
| Phase 2 — Dynamic settlements | MERGED | `origin/master` @ `2d5b89d` | `js/systems/settlement-economy.js`, `js/systems/public-health.js`, `js/systems/world-simulation.js`; `tests/world-simulation*.test.js`, `tests/settlement-economy.test.js`, `tests/public-health.test.js` | None tracked |
| Phase 3 — Persistent NPCs and households | MERGED | `origin/master` @ `2d5b89d` (introduced `#3`/`#4`) | `js/systems/npc-system.js`, `js/systems/household-system.js`, `js/systems/relationship-memory.js`; `tests/npc-system.test.js`, `tests/household-system.test.js`, `tests/relationship-memory.test.js` | None tracked |
| Phase 4A — Reusable medical core | MERGED | `origin/master` @ `2d5b89d` (introduced `#5`/`#6`/`#7`) | `js/systems/medical-system.js`, `js/systems/condition-registry.js`; `tests/medical-core.test.js`, `tests/medical-npc.test.js`, `tests/medical-adapter.test.js` | None tracked |
| Phase 4B — Household health | MERGED | `origin/master` @ `2d5b89d` (`#8`) | `js/systems/household-health.js`, `js/systems/persistent-people-ui.js`; `tests/household-health*.test.js`, `tests/household-treatment.test.js`, `tests/spouse-death.test.js` | None tracked |
| Phase 4C-1 — Business registry | IMPLEMENTED ON BRANCH | `agent/phase-4c1-business-foundation` @ `98c14b6` | `js/systems/business-system.js` exports `ensure/migrate/create/get/all/forSettlement/seedSettlement/seedWorld/summary/checkInvariants/financeInputs/calculateAnnualResult/tickBusiness/tickSettlement/tickWorld/close`; `tests/business-system.test.js` | Not merged. See Phase 4C page for review status |
| Phase 4C-2 — Employment contracts | IMPLEMENTED ON BRANCH | `agent/phase-4c1-business-foundation` @ `98c14b6` | `js/systems/employment-system.js` exports `ensure/migrate/create/hire/end/get/all/forPerson/forBusiness/activeForPerson/activeForBusiness/payBusinessPayroll/syncBusinessEmployees/syncAllBusinessEmployees/reconcilePerson/reconcilePlayer/reconcileNpcs/summary/checkInvariants`; `tests/employment-system.test.js` | Not merged. See Phase 4C page |
| Phase 4C-3 — Annual business finance | IMPLEMENTED ON BRANCH | `agent/phase-4c1-business-foundation` @ `98c14b6` | `BusinessSystem.tickBusiness/tickSettlement/tickWorld/financeInputs/calculateAnnualResult` in `js/systems/business-system.js`; `runBusinessYearTick()` wired into `advanceYear()` in `js/ui.js`; `tests/business-finance.test.js` | Not merged. See Phase 4C page |
| Phase 4C-4 — Persistent vacancies | PLANNED | — | `business.vacancies` array exists in the schema but is not populated by any generator; legacy `S.vacancies`/`rollJobVacancies()` random vacancy flow in `js/ui.js`/`js/data.js` is still the only live vacancy path | Full slice — see Phase 4C page |
| Phase 4C-5 — Hiring/career lifecycle | PLANNED | — | No application/promotion/dismissal API exists | Full slice |
| Phase 4C-6 — Workplace life | PLANNED | — | No workplace relationship/event code exists | Full slice |
| Phase 4C-7 — Ownership/entrepreneurship | PLANNED | — | `business.ownerNpcId` field exists but is never set by any system | Full slice |
| Phase 4C-8 — Employer UI | PLANNED | — | No `js/ui/employment-ui.js` or business panel exists | Full slice |
| Phase 5 — Government/law/politics | PLANNED | — | No `js/systems/government-system.js` or `js/systems/law-system.js` exists | Full phase |
| Phase 6 — Advanced health/reproduction | PLANNED | — | No `js/systems/pregnancy-system.js` exists | Full phase |
| Phase 7 — Narrative event chains | PLANNED | — | No `js/systems/event-chain-system.js` exists | Full phase |
| Phase 8 — Property/housing/credit | PLANNED | — | No property/loan system exists | Full phase |
| Phase 9 — Inheritance/dynasty | PLANNED | — | No will/estate system exists; player identity is still the literal string `'subject'` | Full phase |
| Phase 10 — National history | PLANNED | — | `World.nationalModifiers` exists as a plain object consumed by `WorldSimulation.tick`, but no system populates it over time | Full phase |
| Phase 11 — Content/performance/presentation | PLANNED | — | `js/data.js` and `js/ui.js` remain monolithic (1600+ and 2700+ lines) | Full phase |
| Phase 12 — Saves/release | PLANNED | — | No save/load system exists yet; state lives only in the in-memory `World`/`S`/`Lineage`/`Hold` globals during a session | Full phase |

## Phase notes

### Phase 1 — Core stability

Deterministic seeded random (`js/core/random.js`), the `YearEngine` annual
tick wrapper (`js/core/year-engine.js`), bounded-effect application
(`js/core/effects.js`), and general invariant helpers
(`js/core/invariants.js`). Expected merged status confirmed present on
`origin/master`.

### Phase 2 — Dynamic settlement simulation

`SettlementEconomy`, `PublicHealth`, and `WorldSimulation` tick settlement
economy, demographics, security, and public health once per year, seeded
per `(world.seed, year, settlementId, subsystem)`. Expected merged status
confirmed present on `origin/master`.

### Phase 3 — Persistent NPC and household architecture

`NpcSystem` and `HouseholdSystem` give NPCs (including the player's own
family) persistent records in `World.npcs` / `World.households`, independent
of whether they are currently "on screen." `RelationshipMemory` tracks
bounded relationship history between people. Expected merged status
confirmed present on `origin/master`.

### Phase 4A — Reusable medical core

`MedicalSystem` and `ConditionRegistry` give any person (player or NPC) a
shared condition/treatment/mortality model instead of separate player-only
and NPC-only logic. Expected merged status confirmed present on
`origin/master`.

### Phase 4B — Household health

`HouseholdHealthSystem` adds illness transmission between household members,
caregiving hours, family treatment decisions, treatment charges, medical
debt, and notices, plus `PersistentPeopleUI` rendering. **Merged in commit
`2d5b89d` when verified.**

### Phase 4C — Businesses and employment (in progress, branch-only)

The `agent/phase-4c1-business-foundation` branch, verified at `98c14b6`,
contains a working implementation of:

- a persistent business registry (`World.businesses`) with stable
  `business:NNNNN` IDs, deterministic per-settlement seeding, sector/kind/
  status classification, and migration hardening;
- persistent employment contracts (`World.employmentContracts`) with stable
  `employment:NNNNN` IDs, deterministic employer selection (including a
  capacity-aware fallback-employer policy), player/NPC reconciliation, and
  business/employee synchronization;
- deterministic annual business finances (revenue, expenses, payroll,
  profit, cash, debt, struggling status, closure) driven by
  `WorldSimulation.streamFor` rather than the shared `Random` global, with
  same-year idempotency and a `runBusinessYearTick()` hook wired into
  `advanceYear()`.

**Do not assume these details remain accurate without re-reading the source
and tests** — re-verify against `js/systems/business-system.js`,
`js/systems/employment-system.js`, `tests/business-system.test.js`,
`tests/employment-system.test.js`, and `tests/business-finance.test.js` on
the branch before building on top of them.

None of this is in `origin/master` yet. It is IMPLEMENTED ON BRANCH, not
MERGED, until a PR lands on `master`.

**Likely remaining Phase 4C work** (see
[Phase 4C](PHASE-4C-BUSINESSES-AND-EMPLOYMENT.md) for full detail):

- employer-generated persistent vacancies (4C-4);
- application and applicant ranking, hiring from vacancies, promotions,
  salary adjustments, dismissals, layoffs, retirement (4C-5);
- workplace relationships and events (4C-6);
- business ownership and entrepreneurship (4C-7);
- employer/business UI (4C-8);
- full replacement or adaptation of the legacy random-vacancy behavior in
  `js/data.js`/`js/ui.js`;
- elimination of duplicate legacy-income and contract-salary payment paths
  once the new system is ready to be player-facing.

## Immediate next action

Merge readiness review of `agent/phase-4c1-business-foundation` into
`master` should happen before starting 4C-4, **or** 4C-4 (persistent
vacancies) can begin directly on the same branch if the reviewer is
confident in the 4C-1..3 foundation — either is coherent. In both cases the
next concrete implementation slice is **4C-4: employer-generated persistent
vacancies**, because it is the first slice that lets a player or NPC apply
for real work instead of the legacy random-vacancy roll, and every later
4C slice (hiring, promotions, dismissals, ownership, UI) depends on a real
vacancy record existing first.

Before writing that implementation prompt, re-run the verification commands
in [AI-Handoff-Protocol](AI-HANDOFF-PROTOCOL.md) — the branch head above may
be stale.

## Known review rules

Passing tests alone are not enough to mark a slice reviewed or mergeable.
Every review must also check:

- save/world migration correctness (idempotency, no data loss, ID repair);
- annual ordering relative to the rest of `advanceYear()`;
- same-year idempotency and stale-year rejection on any annual tick;
- deterministic seeded streams (no `Math.random`/shared `Random` in
  replayable code — see [Engineering Rules](ENGINEERING-RULES.md));
- no duplicate payment or duplicate progression paths;
- referential integrity (contracts reference real businesses, businesses
  reference real settlements, etc.);
- bounded state (money, histories, counters, arrays never grow unbounded or
  reach non-finite values).

See [Engineering Rules](ENGINEERING-RULES.md) for the full rule set and
[AI-Handoff-Protocol](AI-HANDOFF-PROTOCOL.md) for the review checklist.
