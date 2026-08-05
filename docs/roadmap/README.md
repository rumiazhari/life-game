# Life File Development Map

## Project goal

Life File is a browser-based, text-driven life simulation. A single played
life ("the subject") exists inside a persistent, deterministic world that
outlives them. The long-term goal is a world that simulates, in parallel with
the player:

- persistent settlements with their own economy, demographics, security, and
  public health;
- persistent NPCs with their own lives, relationships, and mortality;
- households and household finances;
- relationship memory between people;
- reusable medical conditions, treatment, and mortality;
- businesses and employment;
- government, law, and politics;
- property, housing, and credit;
- inheritance and multi-generation dynasty play;
- national history that evolves independently of the player;

so that when the player's character dies, play can continue as a descendant
inside the same persistent world rather than starting over.

## Current state

See [`CURRENT-STATUS.md`](CURRENT-STATUS.md) for the live, Git-verified
status. Do not treat the summary below as authoritative — it is a snapshot
and will go stale.

As of commit `98c14b6` on branch `agent/phase-4c1-business-foundation`
(not yet merged to `master`):

- Merged on `master` (`2d5b89d`): Phases 1–4B — core stability, dynamic
  settlements, persistent NPCs/households, the reusable medical core, and
  household health.
- Implemented on the `agent/phase-4c1-business-foundation` branch, not yet
  merged: Phase 4C slices 4C-1 through 4C-3 — persistent business registry,
  persistent employment contracts, and deterministic annual business
  finances.
- Not yet started: Phase 4C slices 4C-4 onward (vacancies, hiring, workplace
  life, ownership, UI), and Phases 5–12.

## Roadmap overview

| Phase | Scope | Status | Canonical page |
|---|---|---|---|
| 1 | Core stability | MERGED | [Completed Foundation](COMPLETED-FOUNDATION.md) |
| 2 | Dynamic settlements | MERGED | [Completed Foundation](COMPLETED-FOUNDATION.md) |
| 3 | Persistent NPCs and households | MERGED | [Completed Foundation](COMPLETED-FOUNDATION.md) |
| 4A | Reusable medical core | MERGED | [Completed Foundation](COMPLETED-FOUNDATION.md) |
| 4B | Household health | MERGED | [Completed Foundation](COMPLETED-FOUNDATION.md) |
| 4C | Businesses and employment | IN PROGRESS (branch-only) | [Phase 4C](PHASE-4C-BUSINESSES-AND-EMPLOYMENT.md) |
| 5 | Government, law, surveillance, politics | PLANNED | [Phase 5](PHASE-5-GOVERNMENT-LAW-AND-POLITICS.md) |
| 6 | Advanced medicine, disability, reproduction | PLANNED | [Phase 6](PHASE-6-ADVANCED-HEALTH-AND-REPRODUCTION.md) |
| 7 | Multi-year narrative event chains | PLANNED | [Phase 7](PHASE-7-NARRATIVE-EVENT-CHAINS.md) |
| 8 | Property, housing, assets, credit | PLANNED | [Phase 8](PHASE-8-PROPERTY-HOUSING-AND-CREDIT.md) |
| 9 | Estates, inheritance, guardianship, dynasty | PLANNED | [Phase 9](PHASE-9-INHERITANCE-AND-DYNASTY.md) |
| 10 | National history and institutions | PLANNED | [Phase 10](PHASE-10-NATIONAL-HISTORY.md) |
| 11 | Content, architecture, performance, presentation | PLANNED | [Phase 11](PHASE-11-CONTENT-PERFORMANCE-AND-PRESENTATION.md) |
| 12 | Save management and release infrastructure | PLANNED | [Phase 12](PHASE-12-SAVES-AND-RELEASE.md) |

## Recommended order

```
Phase 4C completion
  → Phase 5  (government/law — needed before deep legal/political event chains)
  → Phase 6  (advanced health/reproduction — needed for births feeding dynasty play)
  → Phase 7  (narrative event chains — consumes government, law, and health state)
  → Phase 8  (property and credit — needed before large inheritance estates)
  → Phase 9  (inheritance and dynasty — needs property, business ownership, government)
  → Phase 10 (national history — backdrop for all of the above, can begin in parallel)
  → Phase 11 (content, performance, presentation — hardening pass)
  → Phase 12 (saves and release)
  → release packaging
```

Phases 5–10 have real dependencies on each other (see each phase page's
"Dependencies" section) but do not strictly have to ship in numeric order;
the sequence above is the recommended path, not a hard requirement.

## Navigation

- [Current Status](CURRENT-STATUS.md)
- [Repository Architecture](REPOSITORY-ARCHITECTURE.md)
- [Engineering Rules](ENGINEERING-RULES.md)
- [Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md)
- [Completed Foundation (Phases 1–4B)](COMPLETED-FOUNDATION.md)
- [Phase 4C — Businesses and Employment](PHASE-4C-BUSINESSES-AND-EMPLOYMENT.md)
- [Phase 5 — Government, Law, and Politics](PHASE-5-GOVERNMENT-LAW-AND-POLITICS.md)
- [Phase 6 — Advanced Health and Reproduction](PHASE-6-ADVANCED-HEALTH-AND-REPRODUCTION.md)
- [Phase 7 — Narrative Event Chains](PHASE-7-NARRATIVE-EVENT-CHAINS.md)
- [Phase 8 — Property, Housing, and Credit](PHASE-8-PROPERTY-HOUSING-AND-CREDIT.md)
- [Phase 9 — Inheritance and Dynasty](PHASE-9-INHERITANCE-AND-DYNASTY.md)
- [Phase 10 — National History](PHASE-10-NATIONAL-HISTORY.md)
- [Phase 11 — Content, Performance, and Presentation](PHASE-11-CONTENT-PERFORMANCE-AND-PRESENTATION.md)
- [Phase 12 — Saves and Release](PHASE-12-SAVES-AND-RELEASE.md)
- [AI Handoff Protocol](AI-HANDOFF-PROTOCOL.md)
- [Roadmap Maintenance](ROADMAP-MAINTENANCE.md)

The same set of pages is mirrored on the
[GitHub Wiki](https://github.com/rumiazhari/life-game/wiki) for browsing
outside a clone.
