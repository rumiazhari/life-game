# Life File — RPG Phase 4 Formative Playtest Protocol

**Status:** Ready for participant testing; no human participant data collected.  
**Build target:** Phase 4 on `master`, after verification.  
**Purpose:** Detect friction, opaque chance calculations, false choice agency and unclear multi-year consequences. Do not call automated test pass rates evidence of enjoyment.

## Sampling and ethics
Recruit **6–8 consenting adult volunteers** for exploratory testing. Each session is **8–12 minutes**, followed by an optional 1–5 formative survey and brief debrief. Do not record names, credentials, real employment or medical information, voice, exact location or raw account data. Do not upload the game save. The game does not automatically transmit feedback; the **PLAYTEST** view stores three scores only in page memory, and exports them only when the player chooses **COPY ANONYMOUS REPORT** or **SAVE JSON**. Deleting/reloading the page clears the scores. Allow participants to skip items and quit at any time.

## Moderation script
Give each participant a new or seeded eligible Life File life; keep the seed condition consistent across participants without placing the actual seed in exported reports. Ask them to work **without instructions** initially.

| Task | Expected observation | Pass criterion |
| --- | --- | --- |
| 1. Pick one background and take a Work or Learn quick move | Time to first substantive action, completion, energy interpretation | Action executed, and player identifies its energy cost |
| 2. Start an available story and make one choice | Did they find the story, understand dice chance and fallback, notice the immediate consequence? | Reach a meaningful ending without facilitator taking control |
| 3. Compare a racetrack check with its betting odds | Can the player distinguish 3d6 **quality/handling** probability from the native **50/50 wager**? | Participant explains these are different events |
| 4. Advance a year after filing a connected arc | Can they find the next eligible chapter and identify one detail inherited from an earlier choice? | Identify a genuine continuation or explain why the story remains unavailable |

For a guaranteed follow-up, prepare an eligible career or underworld scenario with the prerequisite completed first chapter already in the canonical story archive. Do not tell participants the branching resolution in advance. Stop and record where they are stuck after 90 seconds; do not turn the session into guided training.

## Observational metrics
- **Unaided task completion**: `n_completed / n_attempted`, separately per task.
- **Probability comprehension**: `n_correctly_separating_3d6_and_50_50 / n_tested`.
- **Consequence recognition**: `n_identifying_valid_prior_choice_carryover / n_tested`.
- **Time to first substantive action**: median seconds from opening the game; manually measured by observer, not automatically tracked.
- **Meaningful choice commentary**: code verbatim-free observations as *clear*, *unclear*, or *not observed*. Count instances where a player declines a roll or names a trade-off. Do not treat the presence of four options as proof of perceived agency.
- **Optional self-report**: Playtest sheet scores for **Enjoyment, Choice agency, Outcome clarity**, each 1 (strongly disagree) to 5 (strongly agree). These are bespoke and **not validated GEQ/PENS scales**. Report each distribution and median with `n`, not significance claims.

## Provisional usability targets — not results
At least 80% unaided completion for tasks 1 and 2; at least 80% correct 3d6-versus-bet explanations; at least 75% recognizing a real multi-year consequence; and a median **≥4/5** on each optional rating among respondents. Treat these targets as prioritization gates for further iteration—not estimates of population performance at this small sample size. Record any severe blocker even if percentages pass.

## What the anonymous JSON includes
Only numeric **retained-archive** counts, documented 3d6 check counts, missing-history count, number of current story leads, RPG grade/merit when present, energy budget and voluntary three-item scores. The archive is bounded, so these counts are **not guaranteed lifetime totals**. There are no names, character IDs, random seeds, NPC relationships, transcript text or web telemetry.

## Tuning rules after real observations
If chance is misunderstood, revise the quality/wager labels and preview placement before touching TN. If players feel coerced, inspect authored guaranteed opt-outs and outcome feedback. If reward pacing is criticized, compare observed merit earned per game year and time to grade II before adjusting the 60-merit introductory reward or RPG thresholds. Re-run `npm run audit:rpg`, all automated tests and the mobile browser checks after any tuning.

## Research basis
Player-experience research distinguishes autonomy, competence and relatedness from mechanical task success (Ryan, Rigby & Przybylski, 2006, https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/). Johnson, Gardner & Perry (2018, DOI https://doi.org/10.1016/j.ijhcs.2018.05.003) evaluated PENS and GEQ measurement structure; this small formative study does not reproduce or validate those instruments.
