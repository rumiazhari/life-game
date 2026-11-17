# Phase 8 — Authoritative character progression verification

**Date:** 2026-11-17 JST. **Base:** master `10cb9ca2e5351c2c7b0635189a2dde403733ba35`, isolated branch `feat/rpg-phase8-character-gear-20261117`.

## Implementation
Added `js/systems/rpg-progression.js`, an additive RPG preview/resolve adapter that reads only **canonical existing World.storyItems** for domain-specific evidence and **EmploymentSystem.activeForPerson** for professional standing. It automatically selects the highest relevant owned evidence bonus, respecting explicit item choices and `autoEvidence:false`. Current curated items: work portfolio labor +2, signed reference social +1, grey duplicate bureau +2, testimony bureau +1, Ward notice bureau +1. The modifier remains clamped to −4..+4 with exact 216 possible 3d6 outcomes. A high legacy `S.jobTier` without a live contract no longer grants a phantom labor bonus; a real tier ≥3 contract does even if the projection is stale. No equipment registry, currency or item duplication was introduced. Story kit now displays domain bonuses as compact visual labels.

## RED→GREEN
- New tests initially failed on missing `RPGProgression` and script load, and the kit indicator initially failed until UI integration.
- Focused `tests/rpg-progression.test.js`: **9 passed, 0 failed**.
- Test cases cover auto ownership, strongest nonstacking bonus, invalid explicit gear, career start/termination and stale projections, exact 3d6 preview/resolution, grade/skill/perk caps, save/reload determinism, script load order and UI.
- Fresh full npm test: **1,074/1,074 passed**. npm run audit:rpg, npm run simulate:rpg, npm run diagnostic:world and npm run diagnostic:npcs: all exit **0**. Modified JavaScript syntax checked with node --check (exit 0).

## Real Chrome browser
Headless Chrome loaded actual `life-game.html`. It displayed **Work portfolio LABOR +2**; labor modifier increased **2→4** from canonical evidence. Exact three-dice resolution used [1,1,1] and [6,6,6] with the same modifier and evidence ID. Horizontal overflow was **zero** at 320, 390, 768 and 1440 px, including Stories kit. No physical Android test or human satisfaction measurement.

## Limits
Phase 8 only maps **known awarded evidence items**; it does not introduce a general physical armor/weapon equipment registry. Other backgrounds/perks/skills remain the previously existing canonical RPG mechanics. Protected maps and travel are not modified.
