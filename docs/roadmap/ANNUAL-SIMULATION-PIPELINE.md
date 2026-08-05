# Annual Simulation Pipeline

## Current actual order

Verified by reading `advanceYear()` in `js/ui.js` on
`agent/phase-4c1-business-foundation` @ `98c14b6`. This is the real order
today, not an aspiration:

1. `S.age++; World.year++` — advance the calendar.
2. `WorldSimulation.tick(World, {random, year})` — settlement economy,
   public health, education capacity, security, demographics for every
   settlement (this call internally runs `WorldSimulation.migrate`, which in
   turn runs `BusinessSystem.migrate` then `EmploymentSystem.migrate`).
3. `NpcSystem.prepareAndResolveHouseholdCases(...)` — prepare/resolve
   household medical cases before anyone's own annual medical progression.
4. `NpcSystem.resolveQueuedFamilyDecisions(...)` — resolve the player's
   queued family-health decisions (still before `NpcSystem.tick`, so a
   member treated this year is already reflected in their own progression
   roll below).
5. `NpcSystem.tick(...)` — persistent NPC lifecycle/employment/health
   progression, deferring household aggregation.
6. `NpcSystem.settleHouseholdTreatmentCharges(...)` — settle this year's
   treatment charges into household finances before `HouseholdSystem.tick`
   reads them.
7. `resolveTravel(); runHoldTick(); ...; runFollowups(); runHistory();
   runMilestones(); runEconomy()` — travel resolution and the legacy
   player economy tick (local cost of living, legacy wage payment).
8. `HouseholdSystem.tick(...)` — household finance settlement using the
   player's economy results from step 7.
9. `runPersonalStandingYearTick()` — legacy player standing/reputation tick.
10. `rollJobVacancies()` (only if unemployed, working-age) — **legacy random
    vacancy roll**, still the only live vacancy path; not yet backed by
    `BusinessSystem`'s persistent `vacancies` array. See
    [Phase 4C](PHASE-4C-BUSINESSES-AND-EMPLOYMENT.md#4c-4--real-employer-generated-vacancies).
11. `resolvePlan(); runPersonalYearTick()` — legacy player plan/queue and
    personal-year effects.
12. `NpcSystem.applyHouseholdHealthTick(...)` — household illness
    transmission and caregiving, run **after** both player and NPC medical
    progression above so transmission reflects everyone's post-progression
    state.
13. `runAffairs(); runReverseAffairs(); tickSkills(); checkCareerProgress()`
    — legacy player relationship/skill/career-ladder progression (this is
    where `S.jobTier`/`S.career`/`S.jobName` actually change).
14. `EmploymentSystem.reconcilePlayer(World, S)`,
    `EmploymentSystem.reconcileNpcs(World)`,
    `EmploymentSystem.syncAllBusinessEmployees(World)` — reconcile the
    legacy career/job change from step 13 into a persistent employment
    contract, do the same for NPCs, then resynchronize every business's
    `employeeIds`.
15. `runBusinessYearTick()` — wrapper around `BusinessSystem.tickWorld`;
    computes deterministic annual business finances (revenue, expenses,
    payroll, profit, cash, debt, struggling/closure) for every business.
16. `guardianTeachTick(); guardianAmbientTick(); guardianIncidentTick();
    schoolYearTick(); runRandomEvents()` — remaining legacy player-facing
    annual systems.
17. `if (S.alive) checkMortality()` — player mortality roll.
18. End-of-year bookkeeping (`fileRecentYearReport()`, render calls,
    achievement checks) and `if (!S.alive) handleDeath()`.

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
9.  Tick business finances, payroll, hiring, and layoffs.    [4C-3 exists; hiring/layoffs planned in 4C-5]
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

Steps 3, 9 (hiring/layoffs portion), 14 (taxes/mortgages portion), 15, 16,
and 18 correspond to systems that are PLANNED, not IMPLEMENTED — see the
linked phase pages.

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
// single callback, not phase registration, as of 98c14b6.
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
