# Phase 8 — Property, Housing, and Credit

**Status: PLANNED.** No code for this phase exists yet. Every file, API,
and state shape below is a plan, not a description of current source.

- **Dependencies:** Phase 4C (`BusinessSystem` — lenders are businesses;
  mortgages are a loan type against a business or a property); Phase 3
  (`HouseholdSystem` — occupancy and finance integration); the existing
  settlement `buildings` array in `js/lore.js`/`KARSEN_SETTLEMENTS`
  (locations, not ownable/rentable units — see 8A).
- **Completion criteria:** see the end of this page.

## 8A — Property registry

Planned property record:

```
// PLANNED
{
  id,                 // "property:00001"
  settlementId,
  buildingId,         // location within the settlement
  propertyType,
  use,                // 'residential' | 'business'
  quality,
  condition,
  capacity,
  value,
  rent,
  owners,             // [{personId or businessId, share}]
  occupantHouseholdId,
  mortgageId,          // -> Loan (8C)
  associatedBusinessId,
  history
}
```

**Important distinction:** the settlement `buildings` arrays already
present in `js/lore.js` (`KARSEN_SETTLEMENTS[i].buildings`) are static
**location definitions** (where a school/clinic/market physically is) — they
remain that. `Property` records are a new, separate concept: ownable/
rentable **units**, which may reference a building as their location but
are not the same thing as the building definition itself. Do not conflate
the two or repurpose the existing buildings array as the property registry.

## 8B — Tenancy and leases

Planned lease record: household (tenant), landlord (personId or
businessId), property, start year, rent, deposit, arrears, status,
eviction, move history.

## 8C — Credit and loans

Planned loan types: personal, medical (integrates with 4B/6's medical debt
concept), mortgage, education, business (integrates with 4C-7 ownership),
informal family debt.

Planned loan record: borrower (`personId`), lender (`businessId` — likely a
`'finance'`-sector business from the existing `BusinessSystem.SECTORS`),
principal, balance, interest rate, annual payment, status, missed-payment
count, collateral (property or business reference), history.

## 8D — Property valuation

Planned deterministic annual appreciation/depreciation driven by settlement
wages, population, rent index (all already available via
`WorldSimulation.getSettlementState`/`SettlementEconomy`), infrastructure
(Phase 10D), unrest, and physical damage (e.g. from Phase 10E war), bounded
per year like every other annual numeric system — see
[Engineering Rules](ENGINEERING-RULES.md#bounded-state).

## 8E — Housing effects

Planned integration points, each an extension of an existing system:

- health/transmission — feeds `HouseholdHealthSystem`'s existing
  transmission model (overcrowding/quality as a transmission-risk input,
  not a new transmission engine);
- happiness — via the existing `Effects` bounded-delta machinery;
- privacy/conflict — feeds `RelationshipMemory`;
- accident risk — feeds `MedicalSystem` (4A/6A) as an occupational-style
  risk source;
- standing — legacy player standing fields;
- child development — feeds Phase 6F;
- overcrowding — a function of `capacity` vs. household size.

## Planned annual ordering

Per [Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md#target-order),
step 14: rent/mortgage/debt/tax ticks run alongside household finance,
after settlement/business ticks (so this year's wage and rent index are
already current) and before legal/government ticks (so unpaid debt can
trigger a legal case the same year).

## Planned migrations and invariants

Standard lifecycle per
[Engineering Rules](ENGINEERING-RULES.md#standard-lifecycle). Invariants
must cover: every property references a real settlement/building; every
lease references a real property and household; every loan references a
real borrower and lender; ownership shares sum to a sane bound (e.g. ≤100%
unless deliberately allowing unallocated shares); no negative/non-finite
value, rent, balance, or interest fields.

## Planned tests

`tests/property-system.test.js`, `tests/loan-system.test.js` covering:
migration hardening, bounded valuation over long runs, lease lifecycle
(start/arrears/eviction), loan repayment/default, and integration with
household finance without double-counting rent/debt payments.

## Completion criteria

- Property, lease, and loan records are all migration-hardened and
  invariant-clean.
- Property valuation responds deterministically and boundedly to
  settlement conditions over a long fast-forwarded run.
- Housing quality/overcrowding measurably feeds into health, happiness, and
  relationship state through existing systems, not a parallel model.
- Loan repayment integrates with household finance exactly once (no double
  debit).
