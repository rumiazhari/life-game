# Repository Architecture

Verified against `agent/phase-4c1-business-foundation` @ `98c14b6` (which is
`origin/master` @ `2d5b89d` plus the branch's business/employment commits).
Re-read the source before trusting API lists — this page can go stale.

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
| `data.js` | Static game content: names, skills, `INC` (legacy flat income table by job tier), `JOBLIST`, `CAREERS`, career-stage qualification logic, and most of the player-facing event/action catalog. | Read-only reference data for `EmploymentSystem`'s legacy-reconciliation sector mapping. `JOBLIST`/`CAREERS`/`INC` must not be renamed — `EmploymentSystem` reads them directly. |
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
| `business-system.js` | Persistent business registry, deterministic settlement seeding, and deterministic annual business finances. | `World.businesses`, `World.businessCounter`, `World.businessSchemaVersion` | `BusinessSystem.migrate` runs inside `WorldSimulation.migrate`; `BusinessSystem.tickWorld` (via `runBusinessYearTick()`) runs late in `advanceYear()`. | `BusinessSystem.migrate` | `tests/business-system.test.js`, `tests/business-finance.test.js` |
| `employment-system.js` | Persistent employment contracts, deterministic employer selection (including a capacity-aware fallback policy), player/NPC legacy reconciliation, business/employee synchronization, annual payroll. | `World.employmentContracts`, `World.employmentContractCounter`, `World.employmentSchemaVersion`; also writes `subject.employmentContractId` on `S` | `EmploymentSystem.migrate` runs inside `WorldSimulation.migrate` (after `BusinessSystem.migrate`); reconciliation + sync run in `advanceYear()` after `checkCareerProgress()`, before `runBusinessYearTick()`. | `EmploymentSystem.migrate` | `tests/employment-system.test.js` |
| `world-gameplay.js` | Installs adapters that route certain legacy player-facing calculations (local cost of living, health pressure, paid income) through `WorldSimulation`/`PublicHealth` instead of static constants. | None (adapter layer) | Installed once at boot (`install()`), not itself an annual step. | N/A | Exercised via `tests/world-gameplay.test.js` |

**Present on the `agent/phase-4c1-business-foundation` branch only, not yet
on `origin/master`:** `business-system.js`, `employment-system.js`, and their
wiring into `world-simulation.js`, `ui.js`, and `life-game.html`.

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
js/systems/business-system.js        (branch only)
js/systems/employment-system.js      (branch only)
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
  households, and (branch-only, not yet merged) businesses and employment
  contracts. This is the object every system's `ensure`/`migrate`/`tick`
  functions read and write. Future systems (property, loans, legal cases,
  event chains, estates, government) belong here too — see
  [Engineering Rules](ENGINEERING-RULES.md#persistent-authority).
- **`S`** — the legacy/player-facing compatibility state (age, stats, job
  fields, skills, relationships-as-seen-by-the-player, etc.). It is not a
  second authoritative entity store: where a persistent equivalent exists
  (e.g. employment), `S` holds only a stable pointer
  (`S.employmentContractId`) or fields that get reconciled into `World`
  each year, not a duplicate copy of the record itself.
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
