# Phase 11 — Quantitative RPG integrity evidence (AEROMI)

**Date:** 2026-11-17 JST. **Starting master:** `cc97a864d7e5624419cf8b496bb197f959367f86`. **Feature branch:** `feat/rpg-phase11-diagnostics-tuning-20261117`.

## Deliverables

- `npm run report:rpg` runs `tools/rpg-integrity-report.js` and writes **`reports/rpg-integrity.json`** plus a self-contained **`reports/rpg-integrity.html`** with key metrics, exact vs empirical 3d6 probabilities, direct story outcomes and per-session evidence.
- The report freshly executes the 12-chapter `audit:rpg` and 180-scripted-playthrough `simulate:rpg` tools rather than copying old numbers. It adds 5 deterministic seeds × 2 policies (safe/bold) × 2 cross-domain chains (work/civic; household/underworld) × 2 stages = **40 instrumented StorySystem sessions**, with clearly **injected prerequisite story archives**, real BusinessSystem company/employment and real NpcSystem NPC relationships. These are **not organically generated play histories**.
- Each game-run record contains end-state, exact NPC/company identity, steps, checks, 3d6 preview/resolve agreement, successful one-energy preflight, deterministic one-time merit, archive idempotency, salary/contract/asset conservation and StorySystem invariants. No new gameplay authority or permanent save fields were added.
- Exact 216 equally weighted 3d6 outcome proportions compared with 1,200 independent seeded rolls at each difficulty. **Easy 90.74% vs 90.50%; standard 74.07% vs 74.00%; hard 50.00% vs 50.50%; severe 25.93% vs 25.83%.** Sampling tolerance uses 4 binomial standard errors + 1 percentage point, set before observing results.

## Measured results

- **40 / 40** generated cross-domain StorySystem sessions completed; **0 softlocks**, **0 direct contract/salary/asset violations**, **0 merit duplicates**, **0 archive duplications**.
- **40** total chapter-start energy units; **800** merit total (20 × 40); no zero-energy admission. All scenarios finished within a 32-step bounded traversal. Real employer and NPC references stayed bound.
- Existing authoring audit: **12 / 12 authored chapters have guaranteed openings**, no broken scene edges. Existing synthetic authored scenario runner: **180 / 180** terminal/archived, zero failures.
- 3d6 exact-vs-sample: all four levels fall within explicit predeclared statistical tolerances. **Do not interpret these as human ability or subjective enjoyment.**
- JSON and HTML bytes were reproduced exactly across two `npm run report:rpg` executions: JSON SHA-256 `C1424C62B21AA57AD96E7DA67AD76639F39C686EDAA4FA5E6D8686B2E343C86D`, HTML `7596B898BBFAEBEE2610A0BA92CEC6303C0F9D47B4C3CFE73B2FF7E639BAC5AA`.

## Verification gates
- **TDD RED**: six new tests failed while `rpg-integrity-core.js` and `rpg-integrity-report.js` were absent; **GREEN**: now 8 focused passing tests, including idempotent WorldSimulation migration, clean NPC/contract/story invariants and saved World/S deterministic replay.
- `npm test`: **1,100 / 1,100 passed; zero failures**.
- `npm run audit:rpg`, `npm run simulate:rpg`, `npm run diagnostic:world`, `npm run diagnostic:npcs`, `npm run report:rpg`: all exit **0**.
- `node --check` on two new report JS files exit 0; `git diff --check` clean.
- Real Chrome headless served static `reports/rpg-integrity.html`: **40** scenario rows, **4** odds rows, 3 keyboard-focusable scroll regions, no remote resource calls, no document/header/page horizontal overflow at **320 / 390 / 768 / 1440 px**. Horizontal table scrolling is contained to its own focusable region at narrow widths.
- No protected `js/map.js`, `js/state.js`, `js/systems/world-gameplay.js` or `assets/maps/**` changes.

## Limitations and tuning decision

No economic or statistical defect was observed under the declared synthetic test scenarios; therefore **no unsupported balance tuning** was applied. The 40 scenarios use archived prerequisite fixtures, not end-to-end organically obtained prior stories. Chrome mobile emulation does **not** establish physical Android coverage. No voluntary human playtest data was collected or inferred. No deployment or publication was attempted.
