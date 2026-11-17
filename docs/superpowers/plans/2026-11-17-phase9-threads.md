# Phase 9 Interlocking Story Threads Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans; each feature must pass focused RED→GREEN and full tests.

**Goal:** Two distinct cross-domain multi-year story chains using existing economic, civic, NPC and StorySystem authorities.
**Architecture:** Add a `js/systems/story-threads.js` transient episode decorator after story-social.js; persist only two bounded stage high-water markers in World. No new salary/legal/NPC truth.
**Stack:** vanilla JS and node:test VM fixtures, Chrome CDP.
**Spec:** docs/superpowers/specs/2026-11-17-phase9-threads.md.

### Task 1 — Prerequisites and first chapters
- [ ] Write tests RED for archive prerequisites, real business and NPC, three routes with unconditional escape, deterministic outcomes, and safe no-wage effects.
- [ ] Implement transient definitions and run wrappers; GREEN.

### Task 2 — Years, exact identity and archive replay
- [ ] Write tests RED for both callbacks strictly later year, stage idempotency after archived history pruning, dead/moved NPC disable, save/reload and 80-year StorySystem invariants.
- [ ] Implement minimal stage/identity guards and metadata archive; GREEN.

### Task 3 — Verification and merge
- [ ] Fresh npm test/audit:rpg/simulate:rpg/diagnostic:world/diagnostic:npcs, JS syntax, browser 320/390/768/1440, git diff --check, protected map diff zero.
- [ ] Commit evidence, PR, automatic merge only when verified; rerun tests on exact merged master. Do not report human engagement.
