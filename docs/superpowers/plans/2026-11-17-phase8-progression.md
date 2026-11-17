# Phase 8 RPG Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans with test-first RED→GREEN loops.

**Goal:** Make canonical story evidence and active occupations meaningfully modify 3d6 checks without a parallel equipment system.
**Architecture:** `js/systems/rpg-progression.js` wraps `RPG.previewCheck/resolveCheck` and reads existing storyItems + EmploymentSystem; `js/ui/story-quest-ui.js` displays badges in the existing story kit. Preserve prior semantics and explicit item checks.
**Tech:** vanilla JS, Node native tests, headless Chrome.
**Spec:** `docs/superpowers/specs/2026-11-17-phase8-progression.md`.

### Task 1 — Evidence and contract authority
- [ ] Write failing tests in `tests/rpg-progression.test.js` for owned evidence, no item, explicit item priority, max modifier and 3d6 preview/resolution.
- [ ] Verify RED; implement adapter and script load after `story-rpg-checks.js`, before `contextual-actions.js`.
- [ ] Verify GREEN, full npm tests, job retirement/switch behavior.

### Task 2 — Visible player feedback and verification
- [ ] Write failing UI test for visible domain bonus badges in Stories gear, preserving existing item source.
- [ ] Implement minimal UI display, verify RED→GREEN, all tests + diagnostics.
- [ ] Verify Chrome 320/390/768/1440, `git diff --check`, zero protected map paths.
- [ ] Commit evidence, push PR, merge only after green and verify exact master.
