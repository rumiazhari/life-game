# Phase 7 Relationship Gameplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Every production change follows a demonstrated RED→GREEN test.

**Goal:** Add NPC-specific trust, rivalry, betrayal and conditional reconciliation to contextual story chapters without duplicating relationship authority.
**Architecture:** `story-social.js` decorates the existing StorySystem methods after Phase 6; real NpcSystem and RelationshipMemory supply all relationship authority, StorySystem supplies archive and effects. One bounded yearly high-water flag controls repeats.
**Tech stack:** vanilla JS, node:test, VM loader, Chrome CDP.
**Spec:** `docs/superpowers/specs/2026-11-17-phase7-social.md`.

## Global constraints
- Base 23e4ef0; branch feat/rpg-phase7-relationship-consequences-20261117.
- Preserve story-context.js and all protected map paths.
- Never invent entities or persist an alternate trust table.

### Task 1 — Runtime NPC-specific encounters
**Files:** create `js/systems/story-social.js`, `tests/story-social.test.js`; change `life-game.html`.
- [ ] Write failing tests for real living NPC, relationship threshold, no phantom NPC, 3 choices and guaranteed exit.
- [ ] Observe RED; implement canonical context discovery and story wrappers; observe GREEN.
- [ ] Test updated probabilities, negative and positive valence on real NPCs, fail-forward, year and archive ID checks.

### Task 2 — Echoes, migration and browser
- [ ] Write failing tests for next-year same-person continuation, actor death, settlement drift, save/reload, 60 years, 64 archive bound.
- [ ] Observe RED then implement minimal guards.
- [ ] Verify npm test, audit:rpg, simulate:rpg, both diagnostics, all modified JS syntax and Chrome at 320/390/768/1440.
- [ ] Commit evidence, push PR, merge only after tests. Verify exact merged commit.
