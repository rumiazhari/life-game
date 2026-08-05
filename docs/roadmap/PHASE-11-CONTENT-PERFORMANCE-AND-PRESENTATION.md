# Phase 11 — Content, Performance, and Presentation

**Status: PLANNED.** No code for this phase exists yet. Every file/split
below is a plan, not a description of current source — see
[Repository Architecture](REPOSITORY-ARCHITECTURE.md) for the actual
current file layout (`js/data.js` and `js/ui.js` are currently monolithic,
around 1,600 and 2,700 lines respectively).

- **Dependencies:** none blocking — this is a hardening/scaling pass that
  can happen incrementally alongside Phases 5–10, but is listed last in the
  recommended order because splitting files under active cross-phase
  development multiplies merge-conflict risk.
- **Completion criteria:** see the end of this page.

## 11A — Split data modules

Planned structure (moving content out of the current monolithic
`js/data.js`, one module at a time, each a separately reviewable change):

```
js/data/careers.js
js/data/occupations.js
js/data/education.js
js/data/conditions.js
js/data/treatments.js
js/data/laws.js
js/data/properties.js
js/data/event-chains.js
js/data/government.js
js/data/names.js
js/data/settlements.js
```

Do not introduce a bundler, framework, or TypeScript for this split without
a concrete demonstrated need — the project currently runs as plain scripts
loaded directly by the browser (see
[Repository Architecture](REPOSITORY-ARCHITECTURE.md#load-order-lifegamehtml--vm-loaderjs))
and that has worked at the current scale; each new data file just needs to
be added to `life-game.html`'s script list and `tests/helpers/vm-loader.js`'s
`worldFiles` array in the same relative position, per
[Engineering Rules](ENGINEERING-RULES.md#integration-order).

## 11B — Split UI modules

Planned structure (moving rendering/interaction logic out of the current
monolithic `js/ui.js`):

```
js/ui/core-render.js
js/ui/map-ui.js
js/ui/people-ui.js
js/ui/medical-ui.js
js/ui/employment-ui.js
js/ui/business-ui.js
js/ui/government-ui.js
js/ui/property-ui.js
js/ui/event-chain-ui.js
js/ui/save-ui.js
```

`advanceYear()` and the core annual-order logic should remain identifiable
as one clear entry point even after this split (see
[Annual Simulation Pipeline](ANNUAL-SIMULATION-PIPELINE.md#refactor-strategy)) —
UI splitting and annual-order refactoring are related but separate efforts.

## 11C — Map improvement

Planned map hierarchy:

```
national map → settlement → district → building/institution → household/workplace
```

Planned overlays: roads, rail, terrain, farmland, forest, industry, ports,
political control (Phase 5), outbreaks (`PublicHealth`), migration
(existing `runtime.demographics` flow data), businesses (4C), institutions.

## 11D — Unified timeline

Planned: a single chronological view of births, deaths, marriages,
diagnoses, jobs, promotions, layoffs, business closures, property events,
legal cases, policy changes, wars, and migration — sourced from each owning
system's existing `history` arrays (every persistent record already
maintains a bounded `history` per
[Engineering Rules](ENGINEERING-RULES.md#bounded-state)) rather than a
separate duplicated event log. Store timeline entries as **data plus text
keys**, not pre-rendered HTML, so presentation can change without touching
every system's history-writing code.

## 11E — Performance

Planned diagnostic scenarios, extending `tools/world-diagnostic.js`/
`tools/npc-diagnostic.js`: a 200-year single-life run, a large persistent-
NPC-collection run, a multi-generation run (depends on Phase 9), bounded-
history verification across all of the above, save size under realistic
long-play conditions (depends on Phase 12), and annual-tick timing
regression tracking.

## 11F — Accessibility and mobile

Planned: keyboard navigation, visible focus states, reduced-motion support,
scalable text, screen-reader labels, non-color-only status indicators,
mobile-friendly touch targets, offline support (ties into Phase 12F's PWA
work).

## 11G — Balance framework

Planned: scenario simulations across many seeds for poverty, wealth
mobility, chronic illness, business ownership, political dissidence, and
multi-generation outcomes, using **distributions over many deterministic
seeds** (leveraging the existing `WorldSimulation.streamFor`/`Random.create`
determinism) rather than asserting one single exact outcome — the goal is
statistical balance checking, not a golden-master snapshot test.

## Completion criteria

- `js/data.js` and `js/ui.js` are split into the modules above without any
  behavior change (verified by the full existing test suite and
  diagnostics passing identically before and after each split).
- A 200-year single-life diagnostic run completes within a documented time/
  memory budget with all histories correctly bounded.
- Basic keyboard navigation and screen-reader labeling work across the main
  play flow.
- At least one balance-framework scenario (e.g. poverty distribution) runs
  across many seeds and produces a bounded, reviewable distribution.
