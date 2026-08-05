# Completed Foundation (Phases 1–4B)

All phases on this page are **MERGED** — present on `origin/master` as of
`2d5b89d40068bb6d7747337feb48c54c75232dbc` ("Add complete household health
gameplay (#8)"). Re-verify against current `origin/master` before relying on
this if significant time has passed; see
[AI-Handoff-Protocol](AI-HANDOFF-PROTOCOL.md).

## Phase 1 — Core stability and deterministic random foundation

- **Status:** MERGED
- **Principal files:** `js/core/random.js`, `js/core/year-engine.js`,
  `js/core/effects.js`, `js/core/invariants.js`
- **Authoritative state:** none of its own — provides primitives other
  systems build on (seeded RNG streams, the annual-advance wrapper, bounded
  effect application, general invariant helpers).
- **Completed mechanics:** deterministic seeded RNG with both a shared
  global stream (`Random`) and isolated per-call streams (`Random.create`);
  `YearEngine.configure`/`advance` as the single entry point for annual
  advancement; `Effects.normalize`/`apply` for bounded stat deltas.
- **Important invariants:** `Invariants.boundedStats`/`check` bound player
  stat fields; `checkSettlementRuntimeState` bounds settlement runtime
  fields (used by Phase 2).
- **Tests:** `tests/core.test.js`, `tests/invariants.test.js`.
- **Dependencies created for later phases:** `WorldSimulation.streamFor`
  (Phase 2) is built directly on `Random.create`; every later deterministic
  annual system (Phase 4C business finance, and all planned future phases)
  depends on this pattern — see
  [Engineering Rules](ENGINEERING-RULES.md#deterministic-annual-simulation).
- **Remaining technical debt:** none tracked at this layer.

## Phase 2 — Dynamic settlement simulation

- **Status:** MERGED
- **Principal files:** `js/systems/settlement-economy.js`,
  `js/systems/public-health.js`, `js/systems/world-simulation.js`
- **Authoritative state:** `World.settlements[id].{economy,publicHealth,
  education,security,demographics}`, `World.seed`, `World.settlementArchive`.
- **Completed mechanics:** per-settlement employment/wage/rent/food-price
  indexes and industry demand; sanitation/clinic capacity/demand/outbreak
  risk with shock events; school capacity and enrollment pressure; unrest/
  surveillance/checkpoint pressure; birth/death/internal-migration/external-
  migration demographics with population accounting that must balance
  exactly (`WorldSimulation.tick` asserts this via
  `world.lastMigrationAccounting`).
- **Important invariants:** all runtime numeric fields bounded and finite
  (`repairRuntime`); population accounting equations must balance or the
  runtime is reset to a consistent state; settlement archive/restore is
  lossless when a settlement definition disappears and reappears.
- **Tests:** `tests/world-simulation.test.js`,
  `tests/world-simulation-v2.test.js`, `tests/settlement-economy.test.js`,
  `tests/public-health.test.js`.
- **Dependencies created for later phases:** `WorldSimulation.streamFor`
  is the canonical deterministic-stream factory every later phase (4C
  business finance, and planned Phases 5/6/10) must use;
  `WorldSimulation.getSettlementState` is how every later system reads
  settlement runtime; `World.nationalModifiers` exists as the intended
  integration point for Phase 10 national history.
- **Remaining technical debt:** none tracked at this layer.

## Phase 3 — Persistent NPCs, households, household finance, and relationship memory

- **Status:** MERGED
- **Principal files:** `js/systems/npc-system.js`,
  `js/systems/household-system.js`, `js/systems/relationship-memory.js`
- **Authoritative state:** `World.npcs`, `World.households`.
- **Completed mechanics:** persistent NPC registry independent of whether an
  NPC is "on screen" (identity, family links, employment/education/health
  snapshot fields, household linkage); subject-promotion-on-death (playing
  as a descendant); persistent household membership, dependents, and
  finances; bounded relationship-history tracking between people.
- **Important invariants:** every living NPC belongs to exactly one
  household; household member references resolve to real NPCs;
  `RelationshipMemory` histories are bounded.
- **Tests:** `tests/npc-system.test.js`, `tests/household-system.test.js`,
  `tests/household-economy-integration.test.js`,
  `tests/relationship-memory.test.js`,
  `tests/relationship-memory-integration.test.js`.
- **Dependencies created for later phases:** `World.npcs`/`World.households`
  are the direct foundation for Phase 4C employment (`personId` references
  NPC/subject identity), Phase 6 reproduction (parent/child NPC creation),
  Phase 8 property (household occupancy), and Phase 9 inheritance (heir
  resolution).
- **Remaining technical debt:** the player's own identity is still the
  literal string `'subject'` throughout the codebase rather than a
  `World`-level pointer — see
  [Phase 9](PHASE-9-INHERITANCE-AND-DYNASTY.md#9d--continue-as-descendant)
  for the planned `World.subjectPersonId` refactor this blocks.

## Phase 4A — Reusable medical condition and treatment architecture

- **Status:** MERGED
- **Principal files:** `js/systems/medical-system.js`,
  `js/systems/condition-registry.js`
- **Authoritative state:** `person.health.medical` on any person object
  (player `S` or an NPC record), normalized via
  `MedicalSystem.ensureMedicalState`.
- **Completed mechanics:** one condition/treatment/mortality model shared by
  player and NPCs (previously the player and NPCs had separate logic);
  condition acquisition, progression, treatment access/cost, and mortality
  rolls all route through `MedicalSystem`.
- **Important invariants:** `MedicalSystem.checkInvariants` bounds
  condition state per person.
- **Tests:** `tests/medical-core.test.js`, `tests/medical-npc.test.js`,
  `tests/medical-adapter.test.js`, `tests/medical.test.js`.
- **Dependencies created for later phases:** Phase 4B household transmission
  is built directly on this shared model; Phase 6's expanded condition
  taxonomy and disability system are planned as extensions of
  `MedicalSystem`/`ConditionRegistry`, not a parallel system.
- **Remaining technical debt:** none tracked at this layer.

## Phase 4B — Household illness transmission, caregiving, family treatment, charges, medical debt, notices, and UI

- **Status:** MERGED in commit `2d5b89d` (PR #8) when verified.
- **Principal files:** `js/systems/household-health.js`,
  `js/systems/persistent-people-ui.js`
- **Authoritative state:** `household.medical` (via `HouseholdHealthSystem`,
  scoped under `World.households[id]`).
- **Completed mechanics:** illness transmission between household members;
  caregiving-hours accounting; family treatment decisions (including
  queued/resolved decisions across the annual cycle); treatment charges
  settled into household finances; medical debt; notices surfaced to the
  player; household/person panel rendering.
- **Important invariants:** `HouseholdHealthSystem.checkInvariants`
  includes the rule that `lastCaregivingYear` can never exceed
  `lastTickYear`; treatment charges reconcile with household finance
  settlement ordering (see the annual-order comments in `advanceYear()`
  documented in
  [Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md)).
- **Tests:** `tests/household-health.test.js`,
  `tests/household-health-integration.test.js`,
  `tests/household-health-ui.test.js`, `tests/household-treatment.test.js`,
  `tests/spouse-death.test.js`.
- **Dependencies created for later phases:** the caregiving/notice pattern
  established here is the template Phase 6 (disability/reproduction) and
  Phase 7 (narrative event chains touching health) are expected to reuse
  rather than duplicate.
- **Remaining technical debt:** none tracked at this layer.
