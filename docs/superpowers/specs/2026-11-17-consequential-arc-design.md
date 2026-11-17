# Phase 3 — Consequential Career and Underworld Story Arcs

**Date:** 2026-11-17 (JST)
**Base:** `master` 632b16479a43d4aa581ff3e7cc1674a1b6e359ae
**Branch:** `feat/arcade-rpg-consequence-arcs-20261117`

## Goal
Add two replay-safe, player-initiated two-chapter stories that connect the existing wage, family, civic and night-market quests to real job/NPC/legal outcomes over multiple years. Keep short choices, exact 3d6 chances, guaranteed alternatives and visible next-year callbacks.

## Design and alternatives
- Replacing the story engine or adding independent `World.eventChains` — rejected; duplicates `StorySystem`/archive.
- Adding four isolated missions — rejected; no meaningful cross-quest continuity.
- **Selected:** declarative story episodes in a small `story-consequence-arcs.js` adapter that reads canonical `World.storyArchive` and authoritative employment contracts, and applies only existing `StorySystem` effect operations. No map or extra persistent records.

## Arc A — Career: The Reference File → The Next Interview
- First chapter available to employed adults after completing the wage complaint or Ward petition. Its opening remembers the earlier wage ending and, when present, the kitchen-table caregiving ending.
- Choices: request a coworker recommendation (social 3d6), prepare a portfolio (study 3d6), or work quietly (guaranteed). Failed rolls lead to training, delay or scrutiny without a forced restart.
- Outcomes: optional evidence item, a bounded prospective salary raise **only to the exact original business and contract ID**, actual coworker bond/memory when a real NPC exists, or skills/relations changes. Never create a fictitious job, vacancy, salary, person or cash repayment.
- Second chapter available only in a later year. The initial ending influences opening and choices; changing employer does not redirect the original chapter's wage reward. Its effects remain skills, relationships and memory, not duplicate payroll.

## Arc B — Underworld: The Grey Manifest → The Witness List
- First chapter available to adults after a completed Night Market Bargain. Prior Ward Office hearing influences the difficulty and text of a Bureau-reporting option. Prior night-market ending determines narrative stakes.
- Choices: document evidence (3d6), conceal or negotiate (3d6), or walk away (guaranteed). The first path may yield one evidence item and lower scrutiny; concealment can grant bounded cash while increasing scrutiny; failure produces a lasting setback.
- Second chapter available in a subsequent year; remembers the first ending, reacts to prior civic outcome and optionally consumes existing evidence. No fabricated NPC reference; any fixer bond/memory participant must use a currently existing stable ID.

## Integrations
- Create `js/systems/story-consequence-arcs.js`, loaded after `story-quests.js` and before `story-system.js`. Extend `root.StoryEpisodes` declaratively.
- `story-quest-engine.js`: accept episode-defined `energyCost:1` for new chapters (without changing existing wage and free-quest semantics), guard early filing for **all** opt-in quests (not only wage), and preserve 3d6 deterministic one-shot choice checks.
- `js/ui/story-quest-ui.js`: charge **successful** new chapter start exactly once through existing `markActionDone`/annual ledger; no charge for dialogue.
- `css/story-rpg.css`: existing cards/artwork; minimal category art mapping for CAREER and UNDERWORLD if needed.
- No edits to `js/map.js`, `js/state.js`, `js/systems/world-gameplay.js`, `assets/maps/**`, or map branches.

## Acceptance gates
A1: Four new quests registered once and eligible only with corresponding prior archival state; follow-ups require at least next year and cannot start twice.
A2: Canonical 216-outcome 3d6 preview equals actual deterministic roll. A failed check cannot reroll; guaranteed fallback is always reachable.
A3: Four new chapters cost one existing annual energy on successful UI start; dialogue and filing cost zero. No-energy request makes no run/counter/ledger mutation; unrelated old quest prices remain unchanged.
A4: Original business+contract ID guard prevents wage raise to any new job, including rehire at same company; only actual NPC participants receive bond effects.
A5: At least two distinct persistent endings per chapter with canonical salary, skill, money, scrutiny, relationship memory effects. Real earlier wage/family/ward/market endings alter later dialogue or choices.
A6: Early filing rejected; archive/reward one-shot; replay, prior saves and fast-forward guards preserved.
A7: `npm test`, world/NPC diagnostics, JS syntax and browser QA pass; 320/390/768/1440 px no horizontal overflow; exactly zero protected map file changes.
A8: Human enjoyment and narrative clarity remain playtest outcomes, never inferred from unit tests.
