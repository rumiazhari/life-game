# Phase 6 — Advanced Health and Reproduction

**Status: PLANNED.** No code for this phase exists yet. Every file, API,
and state shape below is a plan, not a description of current source.

- **Dependencies:** Phase 4A (`MedicalSystem`/`ConditionRegistry` — this
  phase extends them); Phase 4B (`HouseholdHealthSystem` caregiving/notice
  pattern — reused, not duplicated); Phase 4C (employment — disability
  affects work capacity); Phase 3 (`World.npcs`/`World.households` — birth
  creates new NPCs and household membership changes).
- **Completion criteria:** see the end of this page.

## 6A — Expanded condition taxonomy

Planned: additional infectious conditions, chronic conditions, injuries,
treatments, occupational risks, and disability outcomes, added to the
**existing** `ConditionRegistry.CONDITIONS`/`TREATMENTS` catalog in
`js/systems/condition-registry.js` and consumed through the **existing**
`MedicalSystem` API (`activeConditions`, `addCondition`, `treat`,
`tickPerson`, `rollMortality`, etc.). This is an extension of Phase 4A, not
a parallel health system — see
[Engineering Rules](ENGINEERING-RULES.md#persistent-authority).

## 6B — Injury and disability

Planned disability domains: mobility, vision, hearing, cognition, chronic
pain, work capacity.

Planned integration points (each an extension of an existing system, not a
new authoritative store):

- employment (4C) — reduced work capacity should feed into
  `EmploymentSystem` contract performance/salary or vacancy qualification,
  not a separate disability-employment model;
- caregiving (4B) — disability should be able to trigger the existing
  `HouseholdHealthSystem` caregiving-hours mechanics;
- housing (Phase 8) — accessibility as a property attribute;
- government benefits (Phase 5) — disability benefits as a government
  budget line;
- mortality (4A) — disability-adjusted mortality risk via the existing
  `MedicalSystem.rollMortality`;
- happiness/treatment costs — via the existing `Effects`/`MedicalSystem`
  cost machinery.

## 6C — Reproductive state

Planned persistent fields per person: fertility, contraception use,
trying-for-child status, sterility, a pointer to an active pregnancy record
(6D), pregnancy history, birth count, and pregnancy-loss history.

## 6D — Pregnancy system

Planned file: `js/systems/pregnancy-system.js`

Planned persistent pregnancy record (stable ID `pregnancy:00001`):

```
// PLANNED
{
  id,
  pregnantPersonId,
  otherParentPersonId,
  householdId,
  settlementId,
  conceptionYear,
  expectedBirthYear,
  prenatalCare,
  risk,
  outcome,        // see below
  childrenIds,
  history
}
```

Planned outcomes: `ongoing`, `live_birth`, `miscarriage`, `stillbirth`,
`maternal_death`, `terminated`.

## 6E — Birth integration

A birth must, in one deterministic, invariant-safe step:

- create a persistent child NPC via `NpcSystem`'s existing registration
  path (do not hand-construct a raw NPC object outside `NpcSystem`);
- establish parent links on the new NPC;
- join a household via the existing `HouseholdSystem` API;
- update the player-facing compatibility state (`S`) where a birth involves
  the player, without creating a duplicate authoritative record;
- update `Lineage` for cross-generation continuity;
- create the child's initial medical record via `MedicalSystem`, and
  surface a household notice via the existing `HouseholdHealthSystem`/
  `NpcSystem` notice pattern;
- affect settlement demographics **exactly once** — `WorldSimulation`
  already tracks births in `runtime.demographics.births` as part of its own
  deterministic per-settlement calculation; a births from `PregnancySystem`
  must not double-count against that, so this integration needs to either
  feed `PregnancySystem` births into `WorldSimulation`'s existing count or
  clearly separate "simulated background population births" from "named,
  persistent-NPC births" without double-adding to settlement population.

## 6F — Infant and child development

Planned: nutrition, attachment, education readiness (feeds into the
existing `js/education.js` enrollment logic), adverse experiences,
developmental conditions (via 6A's extended `ConditionRegistry`), poverty
and disease exposure, household environment effects.

## Planned annual ordering

Per [Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md#target-order):
pregnancy/birth progression fits alongside steps 10–11 (player/NPC medical
ticks), since pregnancy is itself a medical state tracked per-person.

## Planned migrations and invariants

`PregnancySystem.migrate` follows
[Engineering Rules](ENGINEERING-RULES.md#stable-identity). Invariants must
cover: a person has at most one `ongoing` pregnancy at a time; every
pregnancy references real, currently-alive-at-conception people; every live
birth's `childrenIds` resolve to real NPCs; deceased pregnant persons cannot
have `ongoing` pregnancies (must be resolved to `maternal_death` or
transferred, per whatever rule implementation settles on).

## Planned tests

Focused test files: `tests/pregnancy-system.test.js`, extensions to
`tests/medical-core.test.js`/`tests/medical-npc.test.js` for 6A/6B, and a
births-vs-demographics double-count regression test tied to 6E's
integration point.

## Completion criteria

- Pregnancy can start, progress deterministically across years, and resolve
  to exactly one outcome.
- A live birth produces exactly one new persistent NPC with correct parent/
  household/lineage links and exactly one demographic count.
- Disability integrates with employment, caregiving, and government
  benefits without a parallel, duplicate state model for any of the three.
- `MedicalSystem.checkInvariants`/`PregnancySystem.checkInvariants` remain
  clean after migration and after a fast-forwarded multi-year, multi-birth
  run.
