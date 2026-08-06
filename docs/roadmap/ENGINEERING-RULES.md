# Engineering Rules

These rules are mandatory for every persistent system added to Life File,
current and future. They were derived from how Phases 1–4C were actually
built and reviewed. Phase pages link back here instead of repeating this
content.

## Persistent authority

Persistent entities belong in `World`. Examples that exist today:

```
World.businesses
World.employmentContracts
World.npcs
World.households
World.settlements
```

Future examples (planned, do not exist yet):

```
World.properties
World.loans
World.legalCases
World.eventChains
World.estates
```

`S` (the legacy/player-facing state) may hold compatibility fields or a
stable pointer into `World` (for example `S.employmentContractId`), but must
never hold a second authoritative copy of an entity that also lives in
`World`. If both `S` and `World` describe the same fact, `World` wins and
`S` is reconciled from it — never the reverse.

## Standard lifecycle

Every persistent **system** (owns a collection of entities) should normally
expose:

```
ensure(world)               // idempotently initialize/repair top-level state
migrate(world, ...)         // full repair pass, called from WorldSimulation.migrate
tick(world, options)        // annual step, where applicable
summary(world, options)     // aggregate read for UI/reporting
checkInvariants(world)      // returns an array of violation strings, never throws
```

Every **entity** within such a system should normally expose:

```
create(world, spec)
get(world, id)
all(world)
forPerson(world, personId)       // where the entity is person-scoped
forSettlement / forBusiness / …  // where the entity is scoped to something else
```

Follow the existing naming precedent (`BusinessSystem`, `EmploymentSystem`)
rather than inventing new verbs for the same concept.

## Stable identity

Use stable, monotonic, zero-padded IDs, e.g.:

```
business:00001
employment:00001
vacancy:00001        (planned)
legal-case:00001     (planned)
pregnancy:00001      (planned)
property:00001       (planned)
loan:00001           (planned)
event-chain:00001    (planned)
estate:00001         (planned)
```

IDs are never reused, even after the entity is closed/deleted/terminated.

Migration for any ID-bearing collection must, in order:

1. scan every object key in the collection;
2. scan every record's own `.id` field;
3. reserve the highest valid ID number found in either scan, advancing the
   collection's counter to at least that value, **before** allocating any
   replacement ID;
4. preserve a record's existing ID when it is valid and not already claimed
   by an earlier-processed record;
5. repair malformed or duplicate IDs by allocating a new ID above the
   reserved high-water mark;
6. process the original object keys in **sorted, deterministic order** so
   repair output does not depend on object insertion order;
7. never silently discard a legacy record — even `null`, a primitive, or an
   array value under a key must survive migration as a repaired record, not
   be dropped;
8. be byte-for-byte idempotent: running migration a second time on already-
   repaired state must produce identical serialized output, including key
   insertion order.

This exact algorithm is implemented in
`BusinessSystem.migrate`/`EmploymentSystem.migrate` — read those as the
reference implementation before implementing a new ID-bearing collection.

## Deterministic annual simulation

Use:

```js
WorldSimulation.streamFor(world, year, entityId, subsystem)
```

to get an isolated seeded stream for any replayable annual calculation. Do
**not** use, inside code that runs as part of a replayable annual tick:

```js
Math.random()
Random.next()
Random.range()
chance()
```

(`Random`/`chance()` are the shared global stream — appropriate for
immediate, one-shot player action resolution such as "roll for whether this
button's action succeeds right now," but not for anything that must produce
the same result on replay of the same seed/year.)

## Idempotency

Every annual record that a tick mutates should carry a last-applied-year
marker (e.g. `business.lastTickYear`, reconciled with `finances.lastYear`).

- A repeated call for the **same year** must be a no-op that returns
  `{applied:false, reason:'already_applied', ...}` (or equivalent) rather
  than re-applying effects.
- A call for a **stale** (earlier) year than the last applied year must
  likewise be a no-op (`reason:'stale_year'`), never mutate state.
- Where a persisted "last-applied" marker exists in more than one place
  (for example both `business.lastTickYear` and `business.finances.lastYear`),
  migration must reconcile them to one authoritative value (the newest
  valid year) so a conflict can never cause an already-applied year to be
  replayed.

## Bounded state

Every persistent numeric or collection field must have a documented,
enforced bound:

- money (cash, debt, revenue, expenses, payroll, profit — signed values get
  a signed bound, unsigned values get a `[0, MAX]` bound);
- probabilities and indexes (`[0, 1]`, or the specific range the subsystem
  already uses, e.g. `SettlementEconomy.MIN_INDEX..MAX_INDEX`);
- histories (trim to a fixed newest-N entries, e.g. 48/64);
- notices/queues;
- counters (never negative, capped at a documented sane maximum for
  malformed-save defense);
- arrays generally (employee lists, vacancy lists, applications, event
  chains — cap at a documented maximum);
- simulated NPC counts.

Malformed saved values (strings, `NaN`, `Infinity`, absurdly large finite
numbers) must be repaired to the nearest bound during migration/normalize,
never allowed to propagate into calculations where they could produce
`NaN`/`Infinity`/unsafe integers downstream. When summing many bounded
per-item values into one aggregate (for example per-contract salaries into
total payroll), clamp each item first, then accumulate with a saturating
bound on the running total — never sum first and clamp only the final
result.

## Integration order

For any new persistent system, build in this order:

```
state schema
  → migration
  → API (create/get/all/…)
  → annual tick
  → integration into advanceYear() / WorldSimulation.migrate
  → invariants
  → focused tests
  → full test suite + diagnostics
  → UI
```

Do not build UI before the state/API/invariants layer is solid — this
repeatedly proved to be the layer where correctness bugs live (see
[AI-Handoff-Protocol](AI-HANDOFF-PROTOCOL.md) for the review checklist that
catches them).

## Compatibility

Do not delete legacy player-facing fields (`S.jobTier`, `S.career`,
`S.vacancies`, etc.) until every code path that reads them has been migrated
to the new persistent equivalent. Adapters that translate between the
legacy shape and the new persistent system are allowed and expected (see
`EmploymentSystem.reconcilePlayer`/`reconcileNpcs` as the reference
pattern). Duplicate **payment** or **progression** paths — two systems both
paying the player's salary, or two systems both advancing a career stage —
are not allowed; when introducing a new system that supersedes part of a
legacy path, either fully replace that path in the same change or clearly
document in the phase page which path is still authoritative until the
replacement lands.

## Review standard

Every review of a persistent-system change must check:

- save/world migration behavior (see Stable identity above);
- deterministic-stream usage (see Deterministic annual simulation above);
- annual ordering (does it run at the correct point in
  [the annual pipeline](ANNUAL-SIMULATION-PIPELINE.md)?);
- fast-forward behavior (`fastForward()` calls `advance()` repeatedly — does
  the system still behave correctly across many rapid years?);
- same-year idempotency and stale-year rejection;
- double-payment or double-progression risk;
- stale references (does anything still point at a deleted/closed/dead
  entity without being reconciled?);
- closure/death cleanup (are dependent records terminated/reconciled when
  their parent entity closes or the person dies?);
- finite values (can any code path produce `NaN`/`Infinity`?);
- history-array bounds;
- invariant completeness (does `checkInvariants` actually cover every new
  field this change introduced?).

See [AI-Handoff-Protocol](AI-HANDOFF-PROTOCOL.md) for how this checklist
fits into the implement/review workflow.
