# Life File RPG Phase 5 — Simulated Playthrough Coverage and Real-Report Readiness

**Date:** 2026-11-17 (JST)  
**Base:** `master` e3cab8e7e7cc29f94b91e70b138fa29f68c733a3  
**Branch:** `feat/rpg-phase5-simulated-playtests-20261117`

## Problem and evidence
Phase 4 merged 12 eligible opt-in quest chapters, exact 3d6 checks, a read-only deterministic graph audit, and an optional three-item player survey. It has 1,037 tests. The graph audit proves authored branching is structurally valid, **not that live `StorySystem` choices, persistent settlement/employment consequences, and next-year quest unlocks are playable across different character conditions**. The in-game anonymized JSON report lacks a real participant collection/aggregate workflow. A 6–8-person formative study is planned but **no human participants have yet been recruited or tested**.

## Technical scope
1. Add a **development-only, deterministic, multi-persona end-to-end RPG simulator** (`tools/rpg-scenario-playtest.js`) that uses actual `StorySystem.startQuest / currentView / next / choose / fileAway` (not just an authored graph walker) in VM instances. Each scenario begins in a known synthetic life with canonical prerequisites, actual employer and real NPC where required. Each policy selects only available actions: risk-seeking, prudent, and guaranteed-safe. Simulate **12 quest chapters × 3 policies × 5 seeds** (180 sessions), then simulate one-year follow-up unlocks for all five linked arc pairs. Limit each run to 32 input transitions, report softlocks, rejected moves, run completion, cost, rolls, grade/merit changes, and state invariants. No production-side auto-play or saved participant data.
2. Add an **offline, explicit-input analyzer** (`tools/rpg-playtest-aggregate.js`) accepting a local JSON array of exported `life-file-playtest-v1` reports. Strictly validate all keys, ranges, and counts; reject malformed/oversized input rather than silently including it. Output n, missingness, response counts, descriptive distributions/median for each item, plus the total reports with a retained archive. Never call the network, produce population statistics, or treat simulated checks as human responses. Emit no names, seeds, IDs or raw narrative in the summary. Its input must be supplied deliberately and is not persisted automatically.
3. Implement **testable acceptance thresholds** in CLI with nonzero exit on simulated softlock, rejected choice, missing ending, missing merit filing, invalid salary contract, or cross-arc follow-up not discoverable next year. Do not adjust TN/merit based on bots.
4. Write report and protocol supplement explaining distinction between scripted-policy coverage and human evaluation. Preserve maps, employment/wage authority and original stories unchanged.

## Constraints
- No `js/map.js`, `js/state.js`, `js/systems/world-gameplay.js`, `assets/maps/**` modifications.
- Developer-only `tools/**`, `tests/**`, `docs/**`, `package.json` changes; no new runtime or dependencies unless a demonstrated bug is fixed with tests first.
- Fully deterministic per-seed runs, no `Math.random()` in replayable game simulation.
- Test-first focused RED/GREEN cycles, full `npm test`, `npm run audit:rpg`, `npm run diagnostic:world`, `npm run diagnostic:npcs`, map diff gate.
- Previous instruction authorizes immediate PR merge after verified completion, but no website deployment claim.

## Acceptance
A1: At least 180 real-engine automated playthroughs; each terminates and files **once** with recorded ending and merit.
A2: 3 policy strategies select only available options and never get stuck for 32 transitions. Checks are deterministic per seed/policy/chapter; repeat runs byte-identical.
A3: All 5 multi-year story pair follow-ups appear strictly after prerequisite chapter filing and advancing year; not same year.
A4: No fabricated participant records, no human enjoyment claims. CLI labels `automated_agent_simulation` explicitly.
A5: Offline aggregator demonstrates strict schema validation, accurate missingness/distributions/median and safe deterministic output on explicit synthetic fixture only. No network, no generated fake survey data presented as real.
A6: 0 protected map files changed; full test and diagnostics green.
