# Dynamic Context Implementation Plan
> Execute using superpowers:executing-plans with TDD and separate review.
**Goal:** Reusable canonical-context quests with durable callbacks.
**Architecture:** Additive adapter to StorySystem. Generated definitions are ephemeral, runs/scenes and archive outcomes persist in existing authorities.
**Tech Stack:** Plain JS, node:test, Chromium/Playwright.
**Spec:** docs/superpowers/specs/2026-11-17-phase6-context.md
## Global Constraints
Protected map files unchanged; exact 3d6 and annual ledger retained. One branch and PR; merge only with all gates green.
## Review Focus
Actor disappears during play; employer switches; archive evicts old outcomes; save reload mid-choice; stale-year replay.
## Tasks
- [ ] Add tests/story-context.test.js: assert real references, three routes, deterministic replay, missing NPC suppression, one-energy preflight, callback timing, fail-forward, duplicate filing, archive cap and save reload. Observe RED.
- [ ] Implement js/systems/story-context.js candidates and StorySystem adapters; load after quest engine in life-game.html. Observe GREEN.
- [ ] Full suite/audit/simulation/diagnostics/syntax/diff/map gates; browser 320/390/768/1440 flows; separate review, evidence, PR, verified merge.
