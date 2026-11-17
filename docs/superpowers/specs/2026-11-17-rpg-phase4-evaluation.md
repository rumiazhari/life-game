# Life File RPG Phase 4 — Decision Agency and Formative Playtest

**Date:** 2026-11-17 (JST)
**Base:** `master` e756a50e285183a8062c98f49e8284087101446e
**Feature branch:** `feat/rpg-phase4-playtest-20261117`

## Evidence before design
A direct VM inspection of all 12 opt-in quests found **five opening scenes without an unconditional, resource-free, non-random option**: `quest_wage_file`, `quest_kitchen_table`, `quest_ward_petition`, `quest_school_press`, and `quest_night_market`. The other seven had one. The reference baseline actor's exact 3d6 odds were **91% easy** (TN 7), **74% standard** (TN 9), **50% hard** (TN 11), and **26% severe** (TN 13). These are in-game probabilities, **not** measured player satisfaction.

Research context: PENS emphasizes autonomy, competence and relatedness as player-experience concepts (Ryan, Rigby & Przybylski 2006; https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/). Validation work cautions against assuming a bespoke survey is a validated experience scale (Johnson, Gardner & Perry 2018; https://doi.org/10.1016/j.ijhcs.2018.05.003). This project uses three transparently **unvalidated, formative** self-report items, never claims to administer GEQ/PENS.

## Decision
1. Give each of the five problematic first-choice scenes a low-reward, **unconditional opt-out** leading to its existing quiet/delayed/withdrawn ending. Append to the existing options, preserving all older indices, choices, probabilities, and original consequences. This fixes the measurable forced-roll issue without changing the canonical RPG TN or adding NPC/financial mechanics. Post-change authored agency: **12/12 initial scenes** with unconditional opt-out.
2. Add read-only `RPGPlaytest` module that summarizes observed life-to-date quest archive data, documented dice count, RPG merit/grade and currently-open stories, and validates three voluntary 1–5 experience ratings. No timer, network, telemetry service, localStorage or save-schema change. Results never claim all-time roll success probability because prior archived checks only record their **count**, not outcomes. Missing check counts are marked unknown.
3. Add a compact optional *Playtest* sheet within the existing Stories panel: three 5-point rows for **Enjoyment, Choice agency, Outcome clarity**, plus **Copy anonymous report**. The experience answers live **only in the current page memory**, are not automatically stored or transmitted, and reports contain no real names, private messages, full narrative text, character ID, seed, or personally identifying details.
4. Add a reproducible development-only CLI `npm run audit:rpg` that loads the actual story catalogue in a deterministic simulated world, checks all opening alternatives and dangling story edges, computes exact probabilities through existing `RPG.previewCheck`, and emits JSON for inspection; never modifies game state, game save files, or map implementation.
5. Write a playable formative protocol and prespecified *targets*, not observed claims: 6–8 volunteers, 8–12 min each, unaided one-tap Work/Learn + one story choice + one later-year continuation, accurate interpretation of 3d6 quality vs 50/50 betting, explanation of one carried-forward consequence. Record task completion, comprehension, decision time, self-reported ratings and reasons for confusion. Do not infer retention or fun from automation.

## Non-negotiable constraints
- Preserve `js/map.js`, `js/state.js`, `js/systems/world-gameplay.js`, `assets/maps/**` and independent map development.
- Preserve original eight and four added chapters, exact action ledger and RPG 3d6 TN; no stat, merit or economy rebalancing without observation.
- All feedback is voluntary, transient, consent-based; no background transmission; browser clipboard only on user action, with explicit success/failure feedback.
- No human response data exist yet; the user can conduct the first real sessions with the merged build.
- Validate with fresh `npm test`, world/NPC diagnostics, runtime Chrome at 320/390/768/1440 px, `npm run audit:rpg`, and protected diff zero.
