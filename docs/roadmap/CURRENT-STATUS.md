# Current Status

**Last verified date:** 2026-08-06
**Verified `origin/master` SHA:** query `git rev-parse origin/master` for the live head — do not trust a hardcoded value on this page.
**Phase 4C implementation merge commit:** `122a2587460810be1714b5a1bef3ddd3aef77f12` ("Add persistent business and employment systems (#9)") — the stable historical commit that brought Phase 4C-1 through 4C-5 into `master`. `origin/master` may already be ahead of this commit.
**PR #9:** [Add persistent business and employment systems](https://github.com/rumiazhari/life-game/pull/9), base `master`, head `agent/phase-4c1-business-foundation` — **MERGED** (squash) 2026-08-06T05:18:23Z.
**Current active feature branch:** none. `agent/phase-4c1-business-foundation` is now historical (its content is merged into `master`) and has not been deleted, but it is not the branch to build on top of. No branch for Phase 4C-6 exists yet.
**Working status source:** `git fetch origin` + `git rev-parse origin/master`, `gh pr view 9`, plus direct inspection of `js/systems/business-system.js`, `js/systems/employment-system.js`, `js/systems/vacancy-system.js`, `js/systems/world-simulation.js`, `js/data.js`, and `js/ui.js` on `origin/master`.
**Documentation version:** 3 (synchronized with the merge of PR #9 — Phase 4C-1 through 4C-5 are now on `master`)

> This page is a snapshot. Before acting on it, re-run the verification
> commands in [AI-Handoff-Protocol](AI-HANDOFF-PROTOCOL.md) — `master` may
> have advanced since this page was written.

## Status table

| Area | Status | Branch/commit | Evidence | Remaining work |
|---|---|---|---|---|
| Phase 1 — Core stability | MERGED | `origin/master` | `js/core/random.js`, `js/core/year-engine.js`, `js/core/effects.js`, `js/core/invariants.js` exist and are exercised by `tests/core.test.js`, `tests/invariants.test.js` | None tracked |
| Phase 2 — Dynamic settlements | MERGED | `origin/master` | `js/systems/settlement-economy.js`, `js/systems/public-health.js`, `js/systems/world-simulation.js`; `tests/world-simulation*.test.js`, `tests/settlement-economy.test.js`, `tests/public-health.test.js` | None tracked |
| Phase 3 — Persistent NPCs and households | MERGED | `origin/master` (introduced `#3`/`#4`) | `js/systems/npc-system.js`, `js/systems/household-system.js`, `js/systems/relationship-memory.js`; `tests/npc-system.test.js`, `tests/household-system.test.js`, `tests/relationship-memory.test.js` | None tracked |
| Phase 4A — Reusable medical core | MERGED | `origin/master` (introduced `#5`/`#6`/`#7`) | `js/systems/medical-system.js`, `js/systems/condition-registry.js`; `tests/medical-core.test.js`, `tests/medical-npc.test.js`, `tests/medical-adapter.test.js` | None tracked |
| Phase 4B — Household health | MERGED | `origin/master` (`#8`) | `js/systems/household-health.js`, `js/systems/persistent-people-ui.js`; `tests/household-health*.test.js`, `tests/household-treatment.test.js`, `tests/spouse-death.test.js` | None tracked |
| Phase 4C-1 — Business registry | MERGED | `origin/master`, via `#9` @ `122a258` | `js/systems/business-system.js` exports `ensure/migrate/create/get/all/forSettlement/seedSettlement/seedWorld/summary/checkInvariants/financeInputs/calculateAnnualResult/tickBusiness/tickSettlement/tickWorld/close`; `tests/business-system.test.js` | None tracked |
| Phase 4C-2 — Employment contracts | MERGED | `origin/master`, via `#9` @ `122a258` | `js/systems/employment-system.js` exports `ensure/migrate/create/hire/end/get/all/forPerson/forBusiness/activeForPerson/activeForBusiness/payBusinessPayroll/syncBusinessEmployees/syncAllBusinessEmployees/reconcilePerson/reconcilePlayer/reconcileNpcs/summary/checkInvariants` (now also the vacancy-backed hiring/promotion/lifecycle API — see 4C-5); `tests/employment-system.test.js`, `tests/employment-lifecycle.test.js` | None tracked |
| Phase 4C-3 — Annual business finance | MERGED | `origin/master`, via `#9` @ `122a258` | `BusinessSystem.tickBusiness/tickSettlement/tickWorld/financeInputs/calculateAnnualResult` in `js/systems/business-system.js`; `runBusinessYearTick()` wired into `advanceYear()` in `js/ui.js`; `tests/business-finance.test.js` | None tracked |
| Phase 4C-4 — Persistent vacancies | MERGED | `origin/master`, via `#9` @ `122a258` | `js/systems/vacancy-system.js` owns `World.vacancies`/`World.vacancyCounter`/`World.vacancySchemaVersion`/`World.vacancyLastTickYear` with stable `vacancy:NNNNN` IDs and `open/filled/expired/withdrawn` status; deterministic per-business generation (`generateForBusiness`/`targetWorkers`), expiry/withdrawal, and migration/placeholder repair; `S.vacancies` is a compatibility projection over `VacancySystem.playerPortalVacancies`, not an independent random roll; `tests/vacancy-system.test.js`, `tests/vacancy-ui-integration.test.js` | None tracked |
| Phase 4C-5 — Hiring/career lifecycle | MERGED | `origin/master`, via `#9` @ `122a258` | `VacancySystem.qualificationDetails/rankApplicant/submitApplication/seedNpcApplications/resolveVacancy/resolvePending/applyAndResolve`; `EmploymentSystem.acceptVacancy/promote/adjustSalary/dismiss/resign/retire/requestPromotion/considerAutomaticPromotion/tickWorld`; player actions (`lookwork`, `presspromo`, `favor`, `quitjob`, `earlyret`) and forced-loss paths (Bureau detention, incarceration) in `js/data.js`/`js/ui.js` route through these APIs instead of directly mutating `S`; `tests/employment-lifecycle.test.js`, `tests/vacancy-ui-integration.test.js` | None tracked |
| Phase 4C-6 — Workplace life | PLANNED | — | No workplace relationship/event code exists | Full slice — next planned Phase 4C work |
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
debt, and notices, plus `PersistentPeopleUI` rendering. Merged prior to the
Phase 4C work described below.

### Phase 4C — Businesses and employment (in progress; 4C-1 through 4C-5 merged)

`origin/master` — as of implementation merge commit `122a258` — contains a
working, tested implementation of:

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
the current `origin/master` before building on top of them.

All of 4C-1 through 4C-5 is now on `origin/master`, merged via
[PR #9](https://github.com/rumiazhari/life-game/pull/9) (squash-merged
2026-08-06T05:18:23Z, merge commit `122a258`). The overall Phase 4C is
**not** complete — 4C-6 through 4C-8 remain PLANNED, so Phase 4C status
stays IN PROGRESS until they land too.

**Local validation reported for the reviewed PR head before the squash
merge** (not GitHub-hosted CI — no CI checks exist for this repository;
re-run locally to confirm before trusting):

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

**Prepare and implement Phase 4C-6 — workplace life**, starting from the
current live `origin/master` (Phase 4C-1 through 4C-5 are already there).
No implementation branch for 4C-6 has been created as part of this
documentation update — creating one is a separate, later step.

Before writing a 4C-6 implementation prompt, re-run the verification
commands in [AI-Handoff-Protocol](AI-HANDOFF-PROTOCOL.md) to get the current
`origin/master` head — the state recorded on this page may be stale.

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
