# Life File RPG Phase 4 — Verification and Measurement Evidence

**Date:** 2026-11-17 (JST)
**Base:** `master` at `e756a50e285183a8062c98f49e8284087101446e`
**Feature branch:** `feat/rpg-phase4-playtest-20261117`

## Baseline measurements and design decision
Initial VM inspection of all **12** opt-in quest definitions found **5 of 12** opening scenes had no unconditional, free, no-roll option: The Missing Wages, A Place at the Table, The Ward Petition, The Secret Printing Press and Night Market Bargain. The original indices and effects remain intact. Each now has a fourth guaranteed route into an already-authored ending. **12 of 12** now have at least one free/no-roll first option.

The baseline canonical 3d6 chances for an unmodified benchmark actor were: easy **91%** (TN 7), standard **74%** (TN 9), hard **50%** (TN 11), severe **26%** (TN 13). These thresholds were deliberately **not modified** without human playtest evidence.

## Implemented
- A new opt-in **PLAYTEST** section within the existing Stories interface. It shows numeric retained-archive counters plus three voluntary 1–5 ratings (**enjoyment, choice agency, outcome clarity**) with explicit agreement anchors. Scores stay in memory and clear when a new life is loaded; no persistent save schema or background telemetry was added.
- The **COPY ANONYMOUS REPORT** button exports only aggregate quest counts and optional ratings when explicitly activated; failed clipboard permissions produce `COPY FAILED`, not a false success. **SAVE JSON** provides a local download alternative to clipboard access.
- Pure `js/systems/rpg-playtest.js` accurately distinguishes **known historical check counts**, **explicit zero check counts** and **unknown old archive counts**. Archive snapshots are labelled **retained_archive** because only bounded historical records remain.
- `npm run audit:rpg`: deterministic, development-only quest graph/3d6 audit. Output is checked in as `docs/superpowers/reviews/2026-11-17-rpg-audit.json`.
- A participant-ready `docs/playtesting/RPG-PHASE4-PROTOCOL.md` with 6–8-person exploratory testing, 8–12 min tasks, operational definitions and provisional usability targets (not measured results).

## Reproducible analytical results
The actual audit command reported:
- **12** chapters, **69** authored options, **12/12** no-roll/free starting alternatives.
- **0** invalid scene links; **0** cycles; **0** build failures.
- Authored terminal routes require **1–3 decisions**, depending on branch; this is structural depth, **not observed participant response time**.
- Exact chances and 1,200 seeded dice rolls per difficulty:
  - easy **91% exact / 91% seeded**
  - standard **74% exact / 73% seeded**
  - hard **50% exact / 49% seeded**
  - severe **26% exact / 23% seeded**.
- Byte-for-byte repeatability and `<=5` percentage-point discrepancy tests passed. No dataset was used to estimate human engagement, retention or fun.

## Testing actually performed
- Merged Phase 3 baseline: **1,020/1,020 tests passed**.
- Agency fix: observed failing tests for 5 forced-roll openings, then GREEN and full **1,023/1,023**.
- Model: missing-module, script-load, privacy and rating tests RED then GREEN, full **1,027/1,027**.
- UI: collapsed mode, 15 rating buttons, reset, save isolation, clipboard success/rejection paths; RED then GREEN, full **1,031/1,031**.
- Audit: missing script RED, then GREEN, with deterministic simulated results.
- Further tests: local JSON fallback, rating scale anchors, export provenance and reset on world switch; each tested RED then GREEN.
- Fresh final `npm test`: **1,037 passed / 0 failed**.
- `npm run diagnostic:world` **exit 0**; `npm run diagnostic:npcs` **exit 0**.
- `npm run audit:rpg` **exit 0**, relevant `node --check` **exit 0**.

## Real Chrome browser evidence
Headless Chrome loaded the live `life-game.html` at localhost, verified an initially collapsed optional Playtest section; opened the panel, recorded an **agency 4/5** rating, confirmed all 15 rating buttons were present, selected one, and confirmed the operation left `World` unchanged. The exported JSON excluded injected player/seed marker strings. It confirmed the **SAVE JSON** browser link includes current ratings and does not leak those markers. Headless programmatic clipboard copying was rejected and the UI displayed **COPY FAILED**; a separate focused test exercised the successful clipboard Promise path. No actual user-initiated download or human survey was performed.

| Viewport | Page overflow | Stories panel overflow | Rating controls overflow |
| --- | --- | --- | --- |
| 320 px | 0 | 0 | 0 |
| 390 px | 0 | 0 | 0 |
| 768 px | 0 | 0 | 0 |
| 1440 px | 0 | 0 | 0 |

## Boundaries and open measurements
- No human-playtest responses, task completion, decision times or enjoyment measurements exist yet. The 6–8-person protocol specifies **targets**, not outcomes.
- Original merit rewards—including the higher wage-chapter award—were **not retuned** without observed pacing data. Evaluate low-risk opt-out reward satisfaction in human sessions.
- No stat changes, TN changes, new persistent authority or map/travel modifications.
- Independent code-review subagent not available; evidence consists of first-hand unit/system/browser tests plus author's inspection.
- Protected paths `js/map.js`, `js/state.js`, `js/systems/world-gameplay.js`, `assets/maps/**` must show **zero** changes before merging.
