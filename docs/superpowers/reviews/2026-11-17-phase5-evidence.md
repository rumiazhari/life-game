# Life File RPG Phase 5 — Verified Simulated Coverage and Offline Analysis

**Date:** 2026-11-17 (JST)
**Base:** master `e3cab8e7e7cc29f94b91e70b138fa29f68c733a3`
**Branch:** `feat/rpg-phase5-simulated-playtests-20261117`

## Scope and independence
The previous Phase 4 build offered voluntary anonymous self-report and graph-based audits but no real-engine policy coverage across all chapters, nor an offline aggregate for reports voluntarily supplied by users. Phase 5 adds **developer-only tools**; runtime game mechanics, balance probabilities, UI, world systems and maps remain unchanged.

## Real engine synthetic playthroughs — observed
`node tools/rpg-scenario-playtest.js --json` runs **180** real `StorySystem.startQuest/currentView/next/choose/fileAway` sessions under 12 authored chapters, 3 scripted decision policies and 5 fixed seeds. All **180/180** reached a terminal ending, filed once, passed StorySystem invariants, and preserved exactly-once merit. **0** rejected actions, softlocks or duplicate payouts. The five quest pairs (wages, family, Ward, career, underworld) were tested independently in a real engine state: follow-ups **not available in initial year** and **available following a year increment**, filed successfully thereafter.

The scripted policies made:
| Decision policy | Simulated policy definitions | Actual dice checks | Actual successful dice checks | Applied choices |
| --- | --- | ---: | ---: | ---: |
| Bold | Lowest available check probability | 81 | 50 | 81 |
| Prudent | Highest available check probability ≥60%, else safe | 73 | 59 | 86 |
| Safe | Prefer eligible, no-check choices | 0 | 0 | 65 |

Every chapter produced **2–4 distinct terminal endings** across the synthetic scenarios. Saved inspectable aggregate: `docs/superpowers/reviews/2026-11-17-phase5-simulation.json`.

**Determinism:** Two independent runs generated identical JSON SHA-256 digests. Note that seeded-policy output is **not observed human gameplay** and cannot measure enjoyment, real decision times, strategic skill, engagement, or task comprehension.

## Offline participant-report analyzer
`tools/rpg-playtest-aggregate.js` accepts only an explicitly named local `--file` containing 1–256 anonymous `life-file-playtest-v1` objects, each with the exact known keys and consistent bounded counts. Unexpected extra fields (including names or seeds), malformed/missing values, invalid Likert numbers and oversized input are rejected with a nonzero exit and **no report output**. It produces counts, median and 1–5 distributions for *enjoyment, agency, clarity*, as well as missingness. All aggregation tests used **synthetic** fixtures and verified deterministic results. No actual participant exports were loaded.

The output provenance `user_supplied_anonymous_reports_unverified` avoids claims about participant identity, independence or authenticity. Descriptive statistics are not population inference.

## Validation records
- TDD: missing script and npm command tests observed RED then GREEN for the simulator; synthetic-report validation and deterministic aggregate tests observed RED then GREEN.
- Fresh `npm test` after implementation: **1,045 passed, 0 failed** (recheck against the merge SHA).
- `npm run simulate:rpg` and `npm run audit:rpg`: both exit **0**. Two direct JSON runs had identical SHA-256 digests.
- `npm run diagnostic:world` and `npm run diagnostic:npcs`: both exit **0**.
- No runtime game code was modified. Final protected map file diff must be **0**, checked immediately before merge.
- Live Chrome smoke on AEROMI: Playtest panel present, 15 rating controls, anonymous Save JSON valid, injected private markers not exported; **0 horizontal overflow** at 320, 390, 768 and 1440 px. Clipboard rejection correctly showed COPY FAILED.

## Limitations and next measurement gate
No human sessions were performed. The Phase 4 participant protocol remains the method for estimating real usability, with actual human observation required before altering TN, difficulty curves, narrative reward allocation or claiming user satisfaction. Development CLI outputs are not anonymized participant exports and must never be presented as survey results.
