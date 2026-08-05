# Phase 10 — National History

**Status: PLANNED.** No code for this phase exists yet. Every file, API,
and state shape below is a plan, not a description of current source.

- **Dependencies:** Phase 2 (`World.nationalModifiers`,
  `WorldSimulation.streamFor` — this phase populates and reads through the
  existing hooks, does not add new ones); Phase 5 (government — national
  history and government policy are closely linked but distinct: Phase 5 is
  the player-settlement-visible institution layer, Phase 10 is the
  background world-history layer that feeds it).
- **Completion criteria:** see the end of this page.

## 10A — National system

Planned `World.national` state (shape not finalized): economy (inflation,
unemployment, interest rates, productivity), demographics, institutional
capacity, medicine/transport/communication technology level, industry,
conflict, history log.

## 10B — National-to-settlement modifiers

This phase must feed the **existing** `World.nationalModifiers` object —
already read throughout `js/systems/settlement-economy.js` and
`js/systems/world-simulation.js` via `nationalValue(national, [...],
fallback)` — rather than bypassing `WorldSimulation` with a second
settlement-modification path. This is the single most important
architectural constraint for this phase: `WorldSimulation.tick` already has
the integration point; Phase 10 only needs to keep it populated with
meaningful, evolving values over time.

## 10C — Historical periods

Illustrative planned era list (content, not a fixed schema):
reconstruction, industrial expansion, agricultural crisis, public-health
reform, authoritarian consolidation, liberalization, recession, war
mobilization, postwar recovery, education expansion. Each era is expected
to correspond to a bounded window of `World.nationalModifiers` values
rather than a hardcoded one-off effect.

## 10D — Infrastructure

Planned per-settlement infrastructure level affecting transport, utilities,
housing (feeds Phase 8D valuation), medicine (feeds `PublicHealth`), schools
(feeds `js/education.js`), communications. Infrastructure should be modeled
as settlement runtime state extending the existing
`WorldSimulation`/`SettlementEconomy` runtime shape, not a separate parallel
settlement model.

## 10E — War and conscription

Planned mechanics: military service, conscription (interacts with
employment — a conscripted person's employment contract needs a defined
on-leave/terminated behavior, reusing `ContractRecord.status = 'on_leave'`
from 4C-2 rather than inventing a new status), injury/death (routes through
`MedicalSystem`), rationing (feeds settlement food-price index), factory
demand (feeds business sector demand — likely a modifier on
`SettlementEconomy.industryDemand`), displacement/refugees (feeds
settlement migration, already tracked in
`runtime.demographics.internalIn/internalOut/externalMigration`), family
separation, property damage (feeds Phase 8D valuation), repression (feeds
Phase 5F surveillance), veteran status (a persistent flag on the NPC/player
record).

## Planned annual ordering

Per [Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md#target-order),
step 3: national policy/history modifiers apply early, before any
settlement tick, so the whole year's settlement/business/health simulation
reflects the current national state.

## Planned migrations and invariants

Standard lifecycle per
[Engineering Rules](ENGINEERING-RULES.md#standard-lifecycle). Invariants
must cover: `World.nationalModifiers` values stay within documented bounds
(this phase must not be able to push a settlement runtime value out of its
own existing bounds via an extreme modifier); era transitions are
deterministic given the seed; war-state conscription/casualty effects
reconcile correctly with `EmploymentSystem`/`MedicalSystem` (no orphaned
"on leave for war" contract that never resolves).

## Planned tests and diagnostics

`tests/national-system.test.js` covering deterministic era generation,
bounded modifier propagation into settlement runtime (regression-testing
against the existing `tests/world-simulation*.test.js` bounded-runtime
invariants), and war-state employment/medical reconciliation. Extend
`tools/world-diagnostic.js` for very-long (100+ year) national-history runs.

## Completion criteria

- National state evolves deterministically and boundedly over long
  fast-forwarded runs.
- Every national effect on settlements flows through the existing
  `World.nationalModifiers`/`WorldSimulation` integration point.
- War/conscription correctly interacts with employment and medical state
  without leaving orphaned records.
- `checkInvariants` for the national system remains clean after migration
  and after a very-long fast-forwarded run.
