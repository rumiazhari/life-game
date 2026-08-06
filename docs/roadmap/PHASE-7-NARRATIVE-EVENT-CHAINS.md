# Phase 7 — Narrative Event Chains

**Status: PLANNED.** No code for this phase exists yet. Every file, API,
and state shape below is a plan, not a description of current source.

- **Dependencies:** consumes state from Phase 5 (government/law), Phase 6
  (health/reproduction), Phase 4C (businesses/employment), Phase 3
  (households/NPCs) — this phase is a narrative layer over existing
  persistent state, not a new source of truth for any of it.
- **Completion criteria:** see the end of this page.

## Overview

A persistent, multi-year event-chain engine: declarative, deterministic
narrative sequences that unfold over several years, referencing real
persistent people/households/businesses/settlements, with real, lasting
consequences applied through existing systems' APIs — not a one-off
flavor-text event system.

Planned files:

```
js/systems/event-chain-system.js
js/data/event-chains.js
js/ui/event-chain-ui.js
```

## Planned event record shape

Stable ID: `event-chain:00001`.

```
// PLANNED
{
  id,
  definitionId,       // key into js/data/event-chains.js
  status,             // 'active' | 'completed' | 'abandoned' | 'expired'
  currentStage,
  startYear,
  dueYear,
  completionYear,
  settlementId,
  householdId,
  businessId,
  participants,        // array of personId
  variables,           // chain-local state bag
  pendingChoice,
  history
}
```

## Rules

- **Declarative definitions.** Chain definitions in `js/data/event-chains.js`
  describe stages, triggers, and effects data — they must not embed
  arbitrary executable functions the way some of the existing
  `js/data.js` event catalog does. Every effect a definition can apply must
  be one of a small, fixed set of declared effect types routed through
  `EventChainSystem`'s own API, which in turn calls the real owning
  system's API (e.g. an effect that fires someone routes through
  `EmploymentSystem.end`, not a direct field mutation).
- **Deterministic triggers.** Chain start/stage-advance conditions must be
  evaluated deterministically, using `WorldSimulation.streamFor` scoped per
  chain instance where any randomness is involved.
- **Persistent consequences.** Effects must be applied through the owning
  system's real API (`EmploymentSystem`, `HouseholdSystem`,
  `BusinessSystem`, the planned `GovernmentSystem`/`LawSystem`, etc.) —
  never a direct mutation of another system's persistent state from inside
  `event-chain-system.js`. This is the same rule as
  [Engineering Rules](ENGINEERING-RULES.md#persistent-authority) applied to
  a system that by nature touches many other systems' data.
- **Bounded active chains.** Both per-person and world-wide active-chain
  counts must be bounded.
- **Deadlines.** Every active chain has a `dueYear`; an unresolved chain
  past its deadline must resolve deterministically (default outcome), not
  hang forever.
- **One urgent interruption at a time.** At most one chain may present a
  blocking/interrupting player choice in a given year, to avoid stacking
  modal interruptions — lower-priority pending choices queue.

## Priority content (illustrative, not exhaustive)

- family estrangement
- inheritance conflict (ties into Phase 9)
- workplace scandal (ties into Phase 4C-6)
- business collapse (ties into Phase 4C-3 closure)
- criminal investigation (ties into Phase 5E)
- chronic-illness caregiving (ties into Phase 4B/6A)
- pregnancy crisis (ties into Phase 6D)
- protest involvement (ties into Phase 5G)
- forced relocation
- academic controversy
- political appointment (ties into Phase 5G)
- forbidden relationship

## Planned API

```
// PLANNED
EventChainSystem.ensure(world)
EventChainSystem.migrate(world)
EventChainSystem.tick(world, options)
EventChainSystem.startChain(world, definitionId, context)
EventChainSystem.advanceChain(world, chainId, choiceId)
EventChainSystem.forPerson(world, personId)
EventChainSystem.checkInvariants(world)
```

## Planned annual ordering

Per [Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md#target-order),
step 16: after government/legal/household-finance ticks, before mortality
resolution — so a chain can react to this year's government/health/business
events, and mortality resolution afterward can react to (or be caused by) a
chain outcome.

## Planned migrations and invariants

Standard lifecycle per
[Engineering Rules](ENGINEERING-RULES.md#standard-lifecycle) and stable-ID
migration rules. Invariants must cover: every chain references real,
currently-valid participants/settlement/household/business (or is
terminated when a reference goes stale — e.g. a participant dies mid-chain);
bounded active-chain counts; no more than one pending urgent interruption
per person at a time; every chain past its `dueYear` has been resolved.

## Planned tests

`tests/event-chain-system.test.js` covering: deterministic chain triggering
and replay-stability, stage advancement, deadline resolution, bounded active
counts, and at least one integration test per linked system (employment,
household, business closure) verifying the chain calls the real API rather
than mutating state directly.

## Completion criteria

- At least the priority-content chains above exist as data-driven
  definitions.
- Every effect a chain can apply is routed through an existing system's
  real API.
- Chains are deterministic and replay-stable given the same seed/year.
- No chain can exceed its bounded active-count or leave a stale reference
  unresolved.
- `EventChainSystem.checkInvariants` remains clean after migration and
  after a fast-forwarded multi-year, multi-chain run.
