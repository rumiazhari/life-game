# Phase 9 — Inheritance and Dynasty

**Status: PLANNED.** No code for this phase exists yet. Every file, API,
and state shape below is a plan, not a description of current source.

- **Dependencies:** Phase 8 (property/loans — assets to distribute); Phase
  4C-7 (business ownership — businesses to distribute); Phase 3 (`NpcSystem`
  subject-promotion-on-death — the existing mechanism this phase extends);
  Phase 5 (government — legal eligibility for guardianship).
- **Completion criteria:** see the end of this page.

## 9A — Wills

Planned will record: testator (`personId`), executor (`personId`),
bequests (specific asset → beneficiary), residual beneficiaries, status,
creation/replacement history (a person may replace an earlier will; only
the latest active one applies at death).

## 9B — Estate settlement

Planned order of operations at death:

```
1.  freeze assets
2.  identify spouse, children, will, and legal heirs
3.  pay funeral expenses
4.  pay secured debt (mortgages, collateralized loans — Phase 8C)
5.  pay taxes and fees (Phase 5D)
6.  pay unsecured debt
7.  transfer property (Phase 8A)
8.  transfer business ownership (Phase 4C-7)
9.  transfer remaining money
10. reconcile households (Phase 3 HouseholdSystem)
11. close the estate
```

Stable ID: `estate:00001`. This ordering matters: paying secured debt and
taxes before transferring assets prevents an heir from inheriting a
property that still has an unresolved lien attached to the deceased.

## 9C — Guardianship

Planned guardian-selection factors: kinship, relationship closeness (via
`RelationshipMemory`), household capacity, wealth, health, legal
eligibility (Phase 5), and government intervention as a fallback when no
suitable private guardian exists.

## 9D — Continue as descendant

The **same** `World` persists across a generational transition — this is
already the direction `NpcSystem.bootstrapSubject`/subject-promotion is
built in (Phase 3), and this phase extends it into a full estate/dynasty
flow rather than a bare identity swap. Businesses, property, households,
laws, event chains, and national history must all remain exactly as they
were, with only the played identity changing.

Do not duplicate the selected descendant — the promoted NPC's existing
`World.npcs` record becomes the new subject in place, it is not copied into
a second record.

**Planned identity refactor:** the player's identity is currently the
literal string `'subject'` used throughout `js/state.js`, `js/ui.js`,
`js/data.js`, and (on the `agent/phase-4c1-business-foundation` branch)
`EmploymentSystem` (`workerTypeForPerson(personId){ return personId===
'subject' ? 'player' : 'npc'; }`). Before deep multi-generation play, this
should migrate to a `World`-level pointer:

```
// PLANNED — does not exist yet.
World.subjectPersonId
```

with every current `'subject'` string comparison becoming a comparison
against `World.subjectPersonId`. This is a cross-cutting refactor that
touches every system built so far, so it should land as its own reviewed
change **before** Phase 9's guardianship/continuation logic is built on top
of it, not silently bundled into a feature change.

## Planned API

```
// PLANNED
WillSystem.ensure/migrate/create/get/all/checkInvariants
EstateSystem.ensure/migrate/settleEstate/checkInvariants
GuardianshipSystem.ensure/migrate/selectGuardian/checkInvariants
```

## Planned annual ordering

Per [Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md#target-order),
step 18: estate settlement and household-membership reconciliation happen
immediately after mortality resolution (step 17), before invariants/
diagnostics run for the year.

## Planned migrations and invariants

Standard lifecycle per
[Engineering Rules](ENGINEERING-RULES.md#standard-lifecycle). Invariants
must cover: every estate resolves to a `closed` state with all assets
accounted for (nothing left in limbo); no asset transferred to a
nonexistent or already-deceased-without-further-transfer heir; guardianship
always resolves to exactly one guardian or explicit government custody, not
none.

## Planned tests

`tests/will-system.test.js`, `tests/estate-system.test.js`,
`tests/guardianship-system.test.js`, plus a full-cycle integration test:
create a will, own property/business/loans, die, verify the settlement
order above, verify a descendant can be selected and play continues with
the same `World` state intact.

## Completion criteria

- A will can be created, replaced, and correctly applied at estate
  settlement.
- Estate settlement follows the exact ordering in 9B with no step skipped
  or reordered.
- Guardianship selection is deterministic and always resolves.
- Continuing as a descendant preserves every other persistent system's
  state exactly, with no duplicated subject record.
- The `World.subjectPersonId` identity refactor (if not already done
  earlier) lands as its own reviewed change before this phase's
  continuation logic depends on it.
