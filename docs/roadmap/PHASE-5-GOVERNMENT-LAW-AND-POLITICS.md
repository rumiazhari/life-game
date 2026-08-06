# Phase 5 — Government, Law, and Politics

**Status: PLANNED.** No code for this phase exists yet. Every file, API,
and state shape below is a plan, not a description of current source.

- **Dependencies:** Phase 2 (`World.settlements`, `World.nationalModifiers`,
  `WorldSimulation.streamFor`); Phase 4C (government-sector businesses
  already exist as a `BusinessSystem` sector — see below); the existing
  legacy player fields `S.scrutiny`, `S.bureauFavor`, `S.record`,
  `S.jailUntil` in `js/state.js`/`js/data.js`, which 5F must reconcile
  rather than duplicate.
- **Completion criteria:** see the end of this page.

## 5A — Annual orchestration hardening

Before adding government/law annual ticks, migrate the relevant slice of
`advanceYear()` into the registered-phase style described in
[Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md#refactor-strategy),
scoped to just the steps this phase adds (national policy, government
actions, legal cases) so they have one clear, orderable insertion point
instead of being spliced into the existing monolithic function.

## 5B — Government registry

Planned file: `js/systems/government-system.js`

Planned state (`World.government`, shape not finalized):

```
// PLANNED
{
  regime,
  stability,
  legitimacy,
  corruption,
  taxPolicy,
  healthPolicy,
  educationPolicy,
  surveillancePolicy,
  welfarePolicy,
  municipalAdministrations: { [settlementId]: {...} },
  officeHolders: { [officeId]: personId },
  budgets: {...},
  history
}
```

`GovernmentSystem` owns policy and jurisdiction. `BusinessSystem` continues
to own government-sector **workplaces** (the existing `'government'` sector
in `BusinessSystem.SECTORS`) — this phase does not introduce a second
government-employer model, only the policy/institution layer above it.

## 5C — Law registry

Planned files: `js/data/laws.js`, `js/systems/law-system.js`

Planned law record shape:

```
// PLANNED
{
  id,          // "law:00001"
  category,
  activeYears,
  severity,
  detectionRules,
  penalties,
  jurisdiction
}
```

## 5D — Tax and public budgets

Planned revenue sources: income tax, business tax, property tax, fines,
fees. Planned spending categories: healthcare, education, security,
infrastructure, welfare, administration, debt service.

Public spending must modify the **existing** settlement runtime
(`WorldSimulation.getSettlementState(world, id).{economy,publicHealth,
education,security}`) rather than creating a parallel settlement economic
model — see
[Engineering Rules](ENGINEERING-RULES.md#persistent-authority).

## 5E — Justice system

Planned legal-case lifecycle:

```
reported → investigation → charged → hearing → verdict → sentence → closed
```

Planned legal-case record references persistent people (`personId`),
settlements, laws (5C), officers/magistrates (via `personId` into
`World.npcs`, likely government-sector employees from 4C), evidence,
verdicts, and sentences. Stable ID: `legal-case:00001`.

## 5F — Surveillance dossier

Planned: persistent scrutiny level, known associates, incident history,
next-review year, and government attention level per person.

Must integrate with, not duplicate, the existing legacy fields `S.scrutiny`,
`S.bureauFavor`, checkpoint pressure (already computed per-settlement in
`js/systems/world-simulation.js`'s `updateSecurity`), travel, underworld
actions (`S.vice`/`S.crime`/`S.record`/`S.jailUntil`), and government
employment (4C business sector `'government'`) — see
[Engineering Rules](ENGINEERING-RULES.md#compatibility).

## 5G — Politics and protest

Planned: government offices and appointments, municipal elections where
appropriate, government factions, trade unions, dissident organizations
(may integrate with the existing `Hold` resistance/underworld state — see
[Repository Architecture](REPOSITORY-ARCHITECTURE.md#authoritative-state)),
protests, strikes, repression, reform, political careers (likely a new
`CAREERS` track or an extension of the existing `'public'` career-sector
mapping already present in `EmploymentSystem`'s `CAREER_SECTOR_MAP`).

Policy outcomes from this slice write into the existing
`World.nationalModifiers` object, which `WorldSimulation.tick` already
reads (`nationalValue(national, [...], fallback)` calls throughout
`settlement-economy.js`/`world-simulation.js`) — this phase populates that
object over time rather than requiring `WorldSimulation` to change.

## Planned annual ordering

Per the target order in
[Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md#target-order):
national policy modifiers apply early (step 3, before settlement ticks so
policy affects that year's economy/health/security), legal-case/
surveillance/government-action ticks run late (step 15, after household
finance, before narrative chains).

## Planned migrations and invariants

`GovernmentSystem.migrate`/`LawSystem.migrate` follow the standard lifecycle
and stable-ID rules in
[Engineering Rules](ENGINEERING-RULES.md#standard-lifecycle). Invariants
must cover: policy values bounded/finite; every legal case references a
real person, settlement, and law; no orphaned office-holder references
(dead/missing NPC still listed as holding office).

## Planned tests and diagnostics

Focused test files: `tests/government-system.test.js`,
`tests/law-system.test.js`. Extend `tools/world-diagnostic.js` to assert
government/policy values stay bounded across long multi-year runs.

## Completion criteria

- `GovernmentSystem`/`LawSystem` migrations are idempotent and never
  silently discard legacy records.
- National policy changes measurably and deterministically affect
  settlement runtime through `World.nationalModifiers`.
- A legal case can be opened, progressed, and closed with persistent,
  invariant-clean references throughout.
- Existing legacy scrutiny/bureau-favor/record fields are reconciled into
  the new surveillance dossier, not duplicated.
- `checkInvariants` for every new system returns `[]` after migration and
  after a fast-forwarded multi-year run.
