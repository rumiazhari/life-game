# Annual Simulation Pipeline

## Current actual order

Verified by reading `advanceYear()` in `js/ui.js` on
`agent/phase-4c1-business-foundation` at implementation baseline `c1d28f8`.
This is the real order today, not an aspiration — re-verify against the
live branch head before trusting the step numbers below.

1. `S.age++; World.year++` — advance the calendar.
2. `WorldSimulation.tick(World, {random, year})` — settlement economy,
   public health, education capacity, security, demographics for every
   settlement (this call internally runs `WorldSimulation.migrate`, which in
   turn runs `BusinessSystem.migrate`, then `EmploymentSystem.migrate`, then
   `VacancySystem.migrate`, in that order).
3. `NpcSystem.prepareAndResolveHouseholdCases(...)` — prepare/resolve
   household medical cases before anyone's own annual medical progression.
4. `NpcSystem.resolveQueuedFamilyDecisions(...)` — resolve the player's
   queued family-health decisions (still before `NpcSystem.tick`, so a
   member treated this year is already reflected in their own progression
   roll below).
5. `NpcSystem.tick(..., {deferHousehold:true})` — persistent NPC lifecycle/
   employment/health progression, deferring household aggregation.
6. `NpcSystem.settleHouseholdTreatmentCharges(...)` — settle this year's
   treatment charges into household finances before `HouseholdSystem.tick`
   reads them.
7. `resolveTravel(); runHoldTick(); ...; runFollowups(); runHistory();
   runMilestones(); runEconomy()` — travel resolution and the player
   economy tick. `runEconomy()` pays the player's salary from the
   **already-existing authoritative employment contract** (not a flat
   `INC[]` lookup once a contract exists) and records the paid amount on
   `S.__worldWagePaid` via `WorldGameplay.adjustPaidIncome` (wage-index
   adjusted).
8. `HouseholdSystem.tick(World, {..., subjectIncome: S.__worldWagePaid, ...})`
   — household finance settlement consuming the wage paid in step 7.
9. `runPersonalStandingYearTick()` — legacy player standing/reputation tick.
10. `runEmploymentReconciliation()` — `EmploymentSystem.reconcilePlayer(World,
    S)`, `EmploymentSystem.reconcileNpcs(World)`, and
    `EmploymentSystem.syncAllBusinessEmployees(World)`: reconcile the
    player's and every NPC's legacy career/job fields into persistent
    employment contracts, then resynchronize every business's `employeeIds`.
11. `runBusinessYearTick()` — wrapper around `BusinessSystem.tickWorld`;
    computes deterministic annual business finances (revenue, expenses,
    payroll, profit, cash, debt, struggling/closure) for every business.
12. `runEmploymentLifecycleYearTick()` — wrapper around
    `EmploymentSystem.tickWorld`; runs annual performance/satisfaction
    reviews, automatic age-65 retirement, and business-driven layoffs.
13. `runVacancyYearTick()` — calls `VacancySystem.tickWorld` to expire,
    withdraw, and deterministically generate vacancies. It then seeds NPC
    applications for every open vacancy in stable vacancy-ID order when the
    tick either newly applied or reports `already_applied` for the current
    year. A stale-year result does not seed. Application uniqueness and
    annual caps make repeated same-year seeding safe.
14. `checkCareerProgress()` — performs contract-backed automatic promotion.
    It requires an active career contract, skips when `presspromo` is queued,
    and delegates to `EmploymentSystem.considerAutomaticPromotion`.
    Eligible automatic promotions use a prior-year next-stage vacancy,
    retain the same contract ID, and synchronize the player compatibility
    projection through EmploymentSystem.
15. `syncPlayerVacancyPortal()` — first refresh of `S.vacancies` from
    `VacancySystem.playerPortalVacancies`. **Same-year openings remain
    visible here** — they are not auto-resolved this early, so the player
    can see and apply to a vacancy opened this same year.
16. Stage-transition check.
17. `resolvePlan()` — executes the player's queued actions (`lookwork`,
    `presspromo`, `favor`, `quitjob`, `earlyret`, and others from
    `DEC_MAP`/`PUR_MAP`), which may submit or resolve an application,
    request a promotion, resign, or retire against a specific vacancy/
    contract the player selected.
18. `resolvePendingVacancies()` — `VacancySystem.resolvePending(World,
    {year, subject: S})`, which resolves only **prior-year** openings
    (`openedYear < World.year`); this is the automatic-pending-resolution
    pass, deliberately excluding the current year's brand-new openings so
    they stay visible through step 15/16 above before being auto-decided.
19. Post-resolution synchronization: `EmploymentSystem.reconcilePlayer`,
    `EmploymentSystem.reconcileNpcs`, `EmploymentSystem.syncAllBusinessEmployees`,
    then `VacancySystem.syncAllBusinessVacancyIds(World)`.
20. `syncPlayerVacancyPortal()` again — second refresh of `S.vacancies`
    reflecting the post-resolution state (e.g. a vacancy the player just
    filled no longer shows as open).
21. `runPersonalYearTick()` — player's own annual medical progression.
22. `NpcSystem.applyHouseholdHealthTick(...)` — household illness
    transmission and caregiving, run **after both** the NPC medical
    progression in step 5 and the player's own medical progression in step
    21, so transmission reflects everyone's post-progression state.
23. `runAffairs(); runReverseAffairs(); tickSkills(); guardianTeachTick();
    guardianAmbientTick(); guardianIncidentTick(); schoolYearTick();
    runRandomEvents()` — remaining legacy player-facing annual systems.
24. `if (S.alive) checkMortality()` — player mortality roll.
25. End-of-year bookkeeping (`fileRecentYearReport()`, render calls,
    achievement checks) and `if (!S.alive) handleDeath()`.

Notes on invariants this ordering is meant to preserve:

- **Business payroll is accounting only** — `BusinessSystem`'s payroll
  tracking in step 11 does not independently add to `S.assets`; the
  player's salary has exactly **one** cash-payment path, `runEconomy()` in
  step 7.
- **Same-year vs. prior-year vacancy resolution is deliberate**, not an
  oversight: a vacancy opened this year stays visible (steps 13/15) so the
  player can act on it via `resolvePlan()` (step 17) before the automatic
  pending-resolution pass (step 18) only sweeps up openings from *previous*
  years that nobody explicitly resolved yet.
- **`checkCareerProgress()` (step 14) is the automatic persistent-promotion
  adapter**, not a legacy path — it requires an active career contract and
  delegates to `EmploymentSystem.considerAutomaticPromotion`, which
  evaluates a prior-year next-stage vacancy and, when accepted, updates the
  existing contract in place (same contract ID) via the same `promote()`
  used by explicit hiring. It is distinct from the player's explicit
  `presspromo` action (handled during `resolvePlan()`, step 17) — step 14 is
  skipped whenever `presspromo` is already queued for the year, so the two
  paths never compete for the same promotion. Both paths operate on real
  persistent vacancies and `EmploymentSystem` contracts; neither is a
  normal direct-`S`-mutation or random-promotion path (direct `S` mutation
  in `checkCareerProgress()`'s source remains only as a fallback for the
  case where `EmploymentSystem`/`World` are genuinely unavailable).

`fastForward()` simply calls `advance()` (which calls `advanceYear()`) in a
loop up to 15 times, quietly — it does not run a separate code path, so
every idempotency/ordering guarantee above must hold under repeated calls.

## Target order

The order above accreted feature-by-feature and is **not** the intended
long-term shape. The target order below is the direction future phases
should move the pipeline toward — it is a plan, not current behavior. Do not
assume any step below already runs in this position.

```
0.  Migrate and repair all world systems.
1.  Advance the calendar.
2.  Resolve travel arrivals and residence changes.
3.  Apply national policy modifiers.                         [Phase 10]
4.  Tick settlement economy, demographics, security,
    education, and health.
5.  Progress education and legacy player career decisions.
6.  Progress persistent NPC lifecycle and employment.
7.  Reconcile player and NPC employment contracts.
8.  Synchronize businesses and employees.
9.  Tick business finances, payroll, hiring, and layoffs.    [4C-3/4C-5 exist; not yet consolidated into this target order]
10. Tick player medical conditions.
11. Tick NPC medical conditions.
12. Run household transmission after player and NPC
    progression.
13. Resolve household treatment, caregiving, and medical
    charges.
14. Tick rent, mortgages, debts, taxes, and household
    finances.                                                [Phase 8 for mortgages/loans; taxes in Phase 5]
15. Tick legal cases, surveillance, and government actions.  [Phase 5]
16. Advance active narrative chains.                          [Phase 7]
17. Resolve mortality.
18. Settle estates and household membership after deaths.    [Phase 9]
19. Run invariants and diagnostics.
20. Build the annual report and render UI.
```

Target step 9's business-finance, hiring, and layoff capabilities are
already IMPLEMENTED, through Phase 4C-3 and Phase 4C-5 (business finance/
payroll, and hiring/promotion/layoffs/retirement, respectively) — see
[Current actual order](#current-actual-order) above for where they actually
run today. What remains PLANNED for step 9 is not the
functionality itself but its future consolidation into a single registered
`YearEngine` phase (see [Refactor strategy](#refactor-strategy) below).

The genuinely unimplemented target-order items are:

- step 3, national policy modifiers (Phase 10);
- the mortgage and tax portions of step 14 (Phase 8 for mortgages/loans,
  Phase 5 for taxes);
- step 15, legal cases, surveillance, and government actions (Phase 5);
- step 16, advancing narrative event chains (Phase 7);
- step 18, estate settlement after deaths (Phase 9).

See the linked phase pages for each.

## Refactor strategy

Do not rewrite `advanceYear()` in one large change — it is long, has many
subtle ordering comments explaining *why* each step is where it is (several
already quoted above), and a big-bang rewrite is exactly the kind of change
that silently breaks an ordering invariant no test happens to cover.

Instead, move one subsystem at a time into a registered `YearEngine` phase,
verifying identical behavior (same test suite, same diagnostics output)
before and after each move. `YearEngine.configure()` currently wraps the
*entire* `advanceYear()` function as a single callback; the planned
direction is to let it hold an ordered list of phase callbacks instead, so
each subsystem's annual step is independently identifiable and reorderable
without editing one 150+ line function.

**Planned** registration-style shape (illustrative only — `YearEngine` does
not have this API yet):

```js
// PLANNED — not implemented. YearEngine.configure() currently takes one
// single callback, not phase registration; re-check js/core/year-engine.js
// on the live branch head before assuming this is still true.
YearEngine.registerPhase('calendar', advanceCalendar);
YearEngine.registerPhase('settlement-tick', tickSettlements);
YearEngine.registerPhase('npc-lifecycle', tickNpcLifecycle);
YearEngine.registerPhase('employment-reconcile', reconcileEmployment);
YearEngine.registerPhase('business-finance', tickBusinessFinance);
YearEngine.registerPhase('medical-player', tickPlayerMedical);
YearEngine.registerPhase('medical-npc', tickNpcMedical);
// ...
YearEngine.advance({suppressBurst, quiet});
```

Each migration of one subsystem into this style is its own small, reviewable
change per [Engineering Rules](ENGINEERING-RULES.md#integration-order); it
is not a prerequisite for later phases and can happen opportunistically
alongside them.
