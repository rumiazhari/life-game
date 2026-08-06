# Repository Architecture

Verified against `origin/master`, at Phase 4C implementation merge commit
`122a2587460810be1714b5a1bef3ddd3aef77f12` ("Add persistent business and
employment systems (#9)", merged via
[PR #9](https://github.com/rumiazhari/life-game/pull/9)). Run
`git rev-parse origin/master` for the live head, which may already be ahead
of this commit. Re-read the source before trusting API lists — this page
can go stale.

The game is plain browser JavaScript: no build step, no bundler, no
framework, no npm dependencies. `life-game.html` loads every file directly
via `<script>` tags in the order listed in
[Load order](#load-order-lifegamehtml--vm-loaderjs). Because there are no
ES modules, every file executes in one shared global scope; systems attach
themselves as `root.SystemName` (`root` is `globalThis` in the browser and
the VM sandbox's context object in tests).

## Core (`js/core/`)

| File | Responsibility | Public API |
|---|---|---|
| `random.js` | Deterministic seeded RNG. `Random` is the shared/global stream (used for immediate player-facing rolls); `Random.create(seed)` makes an isolated stream for replayable annual simulation. | `Random.{next,range,int,pick,chance,setSeed,reset,isSeeded,create,hashSeed}` |
| `year-engine.js` | Wraps the annual-advance callback so callers use one consistent `advance()` entry point. | `YearEngine.{configure,advance}` |
| `effects.js` | Normalizes and applies bounded numeric stat deltas (health, happiness, etc.) to a person. | `Effects.{normalize,apply,boundedKeys,schemaVersion}` |
| `invariants.js` | General bounded-stat and settlement-runtime invariant checks used by tests/diagnostics. | `Invariants.{boundedStats,check,assertValid,checkSettlementRuntimeState}` |

## Top-level game files (`js/`)

| File | Responsibility | Notes |
|---|---|---|
| `data.js` | Static game content: names, skills, `INC` (legacy flat income table by job tier), `JOBLIST`, `CAREERS`, career-stage qualification logic, and most of the player-facing event/action catalog. Also defines the `terminateSubjectEmployment` helper shared with `ui.js` for forced job-loss paths (Bureau detention, incarceration). | Read-only reference data for `EmploymentSystem`'s legacy-reconciliation sector mapping and `VacancySystem`'s sector-to-role-template generation. `JOBLIST`/`CAREERS`/`INC` must not be renamed — both systems read them directly. Player actions here (`lookwork`, `favor`, `presspromo`, `quitjob`, `earlyret`) call `VacancySystem`/`EmploymentSystem` directly rather than mutating `S` employment fields; direct mutation remains only as a documented fallback when those systems/`World` are unavailable. |
| `lore.js` | `KARSEN_SETTLEMENTS` and other static world-flavor data. | Consumed by `WorldSimulation.definitions()` and `BusinessSystem.seedWorld()`. |
| `state.js` | Defines the `World` object shape at new-game start (`newGame()`), the player-facing `S` object shape (`newSubject()`), settlement lookup helpers (`settlementById`, `currentSettlement`), and travel. | `World` and `S` are both declared as top-level globals here (`let World`, `let S`). |
| `main.js` | Entry point: wires DOM buttons to game actions, boots a new game or resumes. | Thin; most logic lives in `ui.js`. |
| `ui.js` | The annual-advance orchestrator (`advanceYear()`), rendering, and most player-facing interaction logic. | Owns the authoritative annual-order sequence — see [Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md). |
| `education.js` | Per-settlement school/university catalog and enrollment logic. | Static config keyed by settlement id. |
| `medical.js` | Player-facing compatibility adapter over `MedicalSystem` (translates `S`/`World` shapes into `MedicalSystem` calls). | Does not hold its own authoritative state. |

## Systems (`js/systems/`)

| File | Responsibility | Authoritative state | Annual-flow role | Migration | Tests |
|---|---|---|---|---|---|
| `settlement-economy.js` | Per-settlement employment/wage/rent/food-price indexes and industry demand. | `runtime.economy` inside `World.settlements[id]` | Ticked once per settlement per year by `WorldSimulation.tick`. | Via `WorldSimulation`'s `repairRuntime`. | `tests/settlement-economy.test.js` |
| `public-health.js` | Per-settlement sanitation, clinic capacity/demand, outbreak risk, shocks. | `runtime.publicHealth` | Ticked once per settlement per year by `WorldSimulation.tick`. | Via `WorldSimulation`'s `repairRuntime`. | `tests/public-health.test.js` |
| `world-simulation.js` | Orchestrates all settlement runtime state: economy, public health, education capacity, security, demographics (births/deaths/migration). Owns `WorldSimulation.streamFor()`, the canonical deterministic-stream factory for annual systems. | `World.settlements`, `World.seed`, `World.settlementArchive`, `World.lastMigrationAccounting` | Called first in `advanceYear()` via `WorldSimulation.tick`; `WorldSimulation.migrate` runs at the start of `tick` and also drives `BusinessSystem.migrate`/`EmploymentSystem.migrate`. | `WorldSimulation.migrate(world)` | `tests/world-simulation*.test.js` |
| `relationship-memory.js` | Bounded relationship history/closeness between two people. | `npc.relationships[otherId]` (via `NpcSystem`) plus its own registry helpers | Read/written opportunistically by NPC and household systems, not on a fixed annual step of its own. | `RelationshipMemory` exposes its own migrate/repair helpers. | `tests/relationship-memory*.test.js` |
| `condition-registry.js` | Static catalog of medical condition and treatment definitions. | None (read-only registry) | N/A | N/A | Covered indirectly via medical tests |
| `medical-system.js` | Reusable medical condition, treatment, access, and mortality logic for any person (player or NPC). | `person.health.medical` (via `MedicalSystem.ensureMedicalState`) | Player and NPC annual medical progression both call into this in `advanceYear()`/`NpcSystem.tick`. | `MedicalSystem.migrate` (alias of `ensureMedicalState`) | `tests/medical-core.test.js`, `tests/medical-npc.test.js`, `tests/medical-adapter.test.js`, `tests/medical.test.js` |
| `household-system.js` | Persistent households: membership, dependents, finances. | `World.households` | `HouseholdSystem.tick` runs during `advanceYear()` after travel/economy. | `HouseholdSystem.ensure`/normalize on load | `tests/household-system.test.js`, `tests/household-economy-integration.test.js` |
| `household-health.js` | Illness transmission between household members, caregiving, family treatment decisions, treatment charges, medical debt, notices. | `household.medical` (via `HouseholdHealthSystem`) | Runs late in `advanceYear()`, after both player and NPC medical progression. | `HouseholdHealthSystem.migrate` | `tests/household-health*.test.js`, `tests/household-treatment.test.js` |
| `npc-system.js` | Persistent NPC registry: identity, family links, employment/education/health snapshot fields, household linkage, subject promotion on death. | `World.npcs` | `NpcSystem.tick` runs during `advanceYear()`; also drives household-case preparation/resolution. | `NpcSystem.migrate` | `tests/npc-system.test.js`, `tests/spouse-death.test.js` |
| `persistent-people-ui.js` | Rendering helpers for household/person panels. | None | UI only | N/A | Exercised indirectly via `tests/household-health-ui.test.js` |
| `business-system.js` | Persistent business registry, deterministic settlement seeding, and deterministic annual business finances. | `World.businesses`, `World.businessCounter`, `World.businessSchemaVersion` | `BusinessSystem.migrate` runs inside `WorldSimulation.migrate` (first of the three); `BusinessSystem.tickWorld` (via `runBusinessYearTick()`) runs in `advanceYear()` after employment reconciliation, before the employment lifecycle tick. | `BusinessSystem.migrate` | `tests/business-system.test.js`, `tests/business-finance.test.js` |
| `employment-system.js` | Persistent employment contracts; deterministic employer selection (including a capacity-aware fallback policy); the full vacancy-backed hiring/promotion/employer-switching/salary-adjustment/resignation/dismissal/layoff/retirement lifecycle; player/NPC legacy reconciliation; business/employee synchronization; annual payroll and lifecycle reviews. | `World.employmentContracts`, `World.employmentContractCounter`, `World.employmentSchemaVersion`, `World.employmentLifecycleLastTickYear`; also writes `subject.employmentContractId` on `S` | `EmploymentSystem.migrate` runs inside `WorldSimulation.migrate` (second, after `BusinessSystem.migrate`, before `VacancySystem.migrate`); `reconcilePlayer`/`reconcileNpcs`/`syncAllBusinessEmployees` run early in `advanceYear()` (before `runBusinessYearTick()`), `EmploymentSystem.tickWorld` (via `runEmploymentLifecycleYearTick()`) runs right after business finance, and reconciliation runs again after `resolvePlan()`/`resolvePendingVacancies()`. | `EmploymentSystem.migrate` | `tests/employment-system.test.js`, `tests/employment-lifecycle.test.js` |
| `vacancy-system.js` | Persistent employer-generated job vacancies: deterministic per-business generation against a target-workforce calculation, expiry/withdrawal, qualification/ranking, application seeding and resolution, and the player job-portal compatibility projection. | `World.vacancies`, `World.vacancyCounter`, `World.vacancySchemaVersion`, `World.vacancyLastTickYear` | `VacancySystem.migrate` runs inside `WorldSimulation.migrate` (third, after `BusinessSystem.migrate`/`EmploymentSystem.migrate`); `VacancySystem.tickWorld` (via `runVacancyYearTick()`) runs in `advanceYear()` after the employment lifecycle tick, seeding NPC applications the same year it applies; `VacancySystem.resolvePending` resolves prior-year openings after `resolvePlan()`. | `VacancySystem.migrate` | `tests/vacancy-system.test.js`, `tests/vacancy-ui-integration.test.js` |
| `world-gameplay.js` | Installs adapters that route certain legacy player-facing calculations (local cost of living, health pressure, paid income) through `WorldSimulation`/`PublicHealth` instead of static constants. | None (adapter layer) | Installed once at boot (`install()`), not itself an annual step. | N/A | Exercised via `tests/world-gameplay.test.js` |

`business-system.js`, `employment-system.js`, `vacancy-system.js`, and
their wiring into `world-simulation.js`, `ui.js`, `data.js`, and
`life-game.html` are on `origin/master`, merged via
[PR #9](https://github.com/rumiazhari/life-game/pull/9).

## Tests, tools, assets

- `tests/*.test.js` — Node's built-in test runner (`node --test`), one file
  per system plus a few integration/adapter files. `tests/helpers/vm-loader.js`
  loads the plain-script game files into a Node `vm` context (mocking
  `window`/`document`/`navigator`) since there is no module system; load
  order there must mirror `life-game.html`.
- `tools/world-diagnostic.js`, `tools/npc-diagnostic.js` — standalone Node
  scripts that run many simulated years/worlds outside the browser to catch
  regressions (`npm run diagnostic:world`, `npm run diagnostic:npcs`).
- `life-game.html` — the app shell and the authoritative script load order.
- `css/style.css` — styling.
- `assets/maps/` — static map imagery (`karsen-continent.svg` /
  `karsen-continent-concept.png`).

## Load order (`life-game.html` / `vm-loader.js`)

```
js/core/random.js
js/core/year-engine.js
js/core/effects.js
js/core/invariants.js
js/lore.js
js/data.js
js/state.js
js/systems/settlement-economy.js
js/systems/public-health.js
js/systems/business-system.js
js/systems/employment-system.js
js/systems/vacancy-system.js
js/systems/world-simulation.js
js/systems/relationship-memory.js
js/systems/condition-registry.js
js/systems/medical-system.js
js/systems/household-system.js
js/systems/household-health.js
js/systems/npc-system.js
js/systems/persistent-people-ui.js
js/medical.js
js/education.js
js/ui.js
js/systems/world-gameplay.js
js/main.js
```

`tests/helpers/vm-loader.js` maintains its own `worldFiles` array that must
stay in this same relative order. When adding a new system file, add it to
both `life-game.html` and `vm-loader.js`'s `worldFiles`.

## Authoritative state

- **`World`** — owns every persistent world entity: settlements, NPCs,
  households, businesses, employment contracts, and vacancies (the latter
  three merged into `origin/master` via
  [PR #9](https://github.com/rumiazhari/life-game/pull/9)). This is the
  object every system's `ensure`/`migrate`/`tick` functions read and write.
  Future systems (property, loans, legal cases, event chains, estates,
  government) belong here too — see
  [Engineering Rules](ENGINEERING-RULES.md#persistent-authority).
- **`S`** — the legacy/player-facing compatibility state (age, stats, job
  fields, skills, relationships-as-seen-by-the-player, etc.). It is not a
  second authoritative entity store: where a persistent equivalent exists,
  `S` holds only a stable pointer or a synchronized projection, never a
  duplicate authoritative copy —
  - **employment**: `S.employmentContractId` is a stable pointer;
    `S.jobTier`/`S.jobName`/`S.career`/`S.careerYears` are compatibility
    fields kept in sync with the active `World.employmentContracts` record
    each year by `EmploymentSystem.syncPersonLegacy`/`reconcilePlayer`,
    never the other way around for an `origin:'vacancy'` contract;
  - **vacancies**: `S.vacancies` is a **compatibility projection**, rebuilt
    each portal refresh from `VacancySystem.playerPortalVacancies(World, S)`
    — it is not an independently authoritative or randomly-generated list;
    `World.vacancies` is the sole authority.
- **`Lineage`** — owns cross-generation family continuity data used when
  promoting an NPC descendant into the player role after death.
- **`Hold`** — owns resistance/underworld organization state where
  applicable to the current save.
- **`Archive`** and **`Achievements`** (in `js/state.js`) — cross-life,
  `localStorage`-backed systems: `Archive` records past-file history across
  playthroughs; `Achievements` tracks unlocked achievements. Neither is part
  of the single-life `World`/`S` state.

Do not invent APIs that are not in the tables above. If a page in this
roadmap describes a *planned* API or state shape, it is explicitly marked
PLANNED and does not exist in the source yet.
