# Current Status

**Last verified date:** 2026-08-06
**Verified `origin/master` SHA:** `2d5b89d40068bb6d7747337feb48c54c75232dbc` ("Add complete household health gameplay (#8)")
**Verified active development branch:** `agent/phase-4c1-business-foundation`
**Verified implementation baseline:** `c1d28f83fdea036b4caacfcaab1f1010da5e3922` ("Finish persistent employment transition coverage") — the commit reviewed when this page was last written, not necessarily the branch's current head. Run `git rev-parse origin/agent/phase-4c1-business-foundation` for the live head before relying on this page.
**Current pull request:** [PR #9 — Add persistent business and employment systems](https://github.com/rumiazhari/life-game/pull/9), base `master`, head `agent/phase-4c1-business-foundation`, open, not draft, not merged.
**Working status source:** `git fetch origin` + `git rev-parse` against `origin/master` and `origin/agent/phase-4c1-business-foundation`, `gh pr view 9`, plus direct inspection of `js/systems/business-system.js`, `js/systems/employment-system.js`, `js/systems/vacancy-system.js`, `js/systems/world-simulation.js`, `js/data.js`, and `js/ui.js` on that branch.
**Documentation version:** 2 (synchronized with completed Phase 4C-1 through 4C-5 and PR #9)

> This page is a snapshot. Before acting on it, re-run the verification
> commands in [AI-Handoff-Protocol](AI-HANDOFF-PROTOCOL.md) — the branch
> may have advanced since this page was written.

## Status table

| Area | Status | Branch/commit | Evidence | Remaining work |
|---|---|---|---|---|
| Phase 1 — Core stability | MERGED | `origin/master` @ `2d5b89d` (and earlier) | `js/core/random.js`, `js/core/year-engine.js`, `js/core/effects.js`, `js/core/invariants.js` exist and are exercised by `tests/core.test.js`, `tests/invariants.test.js` | None tracked |
| Phase 2 — Dynamic settlements | MERGED | `origin/master` @ `2d5b89d` | `js/systems/settlement-economy.js`, `js/systems/public-health.js`, `js/systems/world-simulation.js`; `tests/world-simulation*.test.js`, `tests/settlement-economy.test.js`, `tests/public-health.test.js` | None tracked |
| Phase 3 — Persistent NPCs and households | MERGED | `origin/master` @ `2d5b89d` (introduced `#3`/`#4`) | `js/systems/npc-system.js`, `js/systems/household-system.js`, `js/systems/relationship-memory.js`; `tests/npc-system.test.js`, `tests/household-system.test.js`, `tests/relationship-memory.test.js` | None tracked |
| Phase 4A — Reusable medical core | MERGED | `origin/master` @ `2d5b89d` (introduced `#5`/`#6`/`#7`) | `js/systems/medical-system.js`, `js/systems/condition-registry.js`; `tests/medical-core.test.js`, `tests/medical-npc.test.js`, `tests/medical-adapter.test.js` | None tracked |
| Phase 4B — Household health | MERGED | `origin/master` @ `2d5b89d` (`#8`) | `js/systems/household-health.js`, `js/systems/persistent-people-ui.js`; `tests/household-health*.test.js`, `tests/household-treatment.test.js`, `tests/spouse-death.test.js` | None tracked |
| Phase 4C-1 — Business registry | IMPLEMENTED ON BRANCH | `agent/phase-4c1-business-foundation`, baseline `c1d28f8` | `js/systems/business-system.js` exports `ensure/migrate/create/get/all/forSettlement/seedSettlement/seedWorld/summary/checkInvariants/financeInputs/calculateAnnualResult/tickBusiness/tickSettlement/tickWorld/close`; `tests/business-system.test.js` | Not merged. PR #9 open — see Phase 4C page |
| Phase 4C-2 — Employment contracts | IMPLEMENTED ON BRANCH | `agent/phase-4c1-business-foundation`, baseline `c1d28f8` | `js/systems/employment-system.js` exports `ensure/migrate/create/hire/end/get/all/forPerson/forBusiness/activeForPerson/activeForBusiness/payBusinessPayroll/syncBusinessEmployees/syncAllBusinessEmployees/reconcilePerson/reconcilePlayer/reconcileNpcs/summary/checkInvariants` (now also the vacancy-backed hiring/promotion/lifecycle API — see 4C-5); `tests/employment-system.test.js`, `tests/employment-lifecycle.test.js` | Not merged. PR #9 open — see Phase 4C page |
| Phase 4C-3 — Annual business finance | IMPLEMENTED ON BRANCH | `agent/phase-4c1-business-foundation`, baseline `c1d28f8` | `BusinessSystem.tickBusiness/tickSettlement/tickWorld/financeInputs/calculateAnnualResult` in `js/systems/business-system.js`; `runBusinessYearTick()` wired into `advanceYear()` in `js/ui.js`; `tests/business-finance.test.js` | Not merged. PR #9 open — see Phase 4C page |
| Phase 4C-4 — Persistent vacancies | IMPLEMENTED ON BRANCH | `agent/phase-4c1-business-foundation`, baseline `c1d28f8` | `js/systems/vacancy-system.js` owns `World.vacancies`/`World.vacancyCounter`/`World.vacancySchemaVersion`/`World.vacancyLastTickYear` with stable `vacancy:NNNNN` IDs and `open/filled/expired/withdrawn` status; deterministic per-business generation (`generateForBusiness`/`targetWorkers`), expiry/withdrawal, and migration/placeholder repair; `S.vacancies` is now a compatibility projection over `VacancySystem.playerPortalVacancies`, not an independent random roll; `tests/vacancy-system.test.js`, `tests/vacancy-ui-integration.test.js` | Not merged. PR #9 open — see Phase 4C page |
| Phase 4C-5 — Hiring/career lifecycle | IMPLEMENTED ON BRANCH | `agent/phase-4c1-business-foundation`, baseline `c1d28f8` | `VacancySystem.qualificationDetails/rankApplicant/submitApplication/seedNpcApplications/resolveVacancy/resolvePending/applyAndResolve`; `EmploymentSystem.acceptVacancy/promote/adjustSalary/dismiss/resign/retire/requestPromotion/considerAutomaticPromotion/tickWorld`; player actions (`lookwork`, `presspromo`, `favor`, `quitjob`, `earlyret`) and forced-loss paths (Bureau detention, incarceration) in `js/data.js`/`js/ui.js` route through these APIs instead of directly mutating `S`; `tests/employment-lifecycle.test.js`, `tests/vacancy-ui-integration.test.js` | Not merged. PR #9 open — see Phase 4C page |
| Phase 4C-6 — Workplace life | PLANNED | — | No workplace relationship/event code exists | Full slice — begins only after PR #9 is merged |
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

### Phase 4C — Businesses and employment (implemented on branch, PR #9 open)

The `agent/phase-4c1-business-foundation` branch, at implementation baseline
`c1d28f8`, contains a working, tested implementation of:

- a persistent business registry (`World.businesses`) with stable
  `business:NNNNN` IDs, deterministic per-settlement seeding, sector/kind/
  status classification, and migration hardening (4C-1);
- persistent employment contracts (`World.employmentContracts`) with stable
  `employment:NNNNN` IDs, deterministic employer selection (including a
  capacity-aware fallback-employer policy), player/NPC reconciliation, and
  business/employee synchronization (4C-2);
- deterministic annual business finances (revenue, expenses, payroll,
  profit, cash, debt, struggling status, closure) driven by
  `WorldSimulation.streamFor` rather than the shared `Random` global, with
  same-year idempotency and a `runBusinessYearTick()` hook wired into
  `advanceYear()` (4C-3);
- persistent employer-generated vacancies (`World.vacancies`, stable
  `vacancy:NNNNN` IDs, `open/filled/expired/withdrawn` lifecycle) generated
  deterministically per business from a target-workforce calculation, with
  expiry/withdrawal, per-business/per-settlement caps, and migration/
  placeholder repair of malformed or cross-business-referenced embedded data
  (4C-4);
- the full hiring/career lifecycle: qualification checks, deterministic
  applicant ranking, player and NPC application seeding, hiring, employer
  switching, same-contract-ID internal promotion, salary adjustment,
  resignation, dismissal, business-driven layoffs, retirement, and early
  retirement — all routed through `EmploymentSystem`/`VacancySystem` rather
  than direct `S`/`npc.employment` mutation, including forced-loss paths
  (Bureau detention, incarceration) and status-accurate application feedback
  (4C-5).

**Do not assume these details remain accurate without re-reading the source
and tests** — re-verify against `js/systems/business-system.js`,
`js/systems/employment-system.js`, `js/systems/vacancy-system.js`,
`tests/business-system.test.js`, `tests/business-finance.test.js`,
`tests/employment-system.test.js`, `tests/employment-lifecycle.test.js`,
`tests/vacancy-system.test.js`, and `tests/vacancy-ui-integration.test.js` on
the branch before building on top of them.

None of this is in `origin/master` yet. It is IMPLEMENTED ON BRANCH, not
MERGED, until [PR #9](https://github.com/rumiazhari/life-game/pull/9) is
reviewed and merged.

**Local validation reported for the reviewed branch** (not GitHub-hosted
CI — re-run locally to confirm before trusting):

- focused Phase 4C and integration tests (`vacancy-system`,
  `employment-system`, `employment-lifecycle`, `vacancy-ui-integration`,
  `business-system`, `business-finance`, `world-gameplay`,
  `household-economy-integration`): 400/400 passed;
- complete `npm test` suite: 691/691 passed;
- `npm run diagnostic:world`: clean;
- `npm run diagnostic:npcs`: clean.

**Remaining Phase 4C work** (see
[Phase 4C](PHASE-4C-BUSINESSES-AND-EMPLOYMENT.md) for full detail):

- workplace relationships and events (4C-6);
- business ownership and entrepreneurship (4C-7);
- employer/business UI (4C-8);
- elimination of any remaining duplicate legacy-income code paths once the
  persistent path is judged ready to be the sole player-facing authority
  (the player's salary already has one cash-payment path today — see the
  [Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md)).

## Immediate next action

**Final review and merge of [PR #9](https://github.com/rumiazhari/life-game/pull/9)**
(`agent/phase-4c1-business-foundation` → `master`). Phase 4C-6 (workplace
life) should not begin before PR #9 is merged — 4C-6 through 4C-8 build on
the persistent employment contracts and vacancies this PR introduces, and
starting them against an unmerged, still-reviewable foundation risks
compounding review scope and rebase conflicts.

Before writing a 4C-6 implementation prompt, re-run the verification
commands in [AI-Handoff-Protocol](AI-HANDOFF-PROTOCOL.md) to confirm PR #9
has actually merged and to get the new `origin/master` head — the state
recorded on this page may be stale.

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
