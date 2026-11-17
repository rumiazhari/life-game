# Phase 10 Choice Feedback Implementation Plan

> REQUIRED SUB-SKILL: superpowers:test-driven-development and verification-before-completion.

**Goal:** Visual consequence and relationship previews integrated with the live 3d6 episode slip.
**Architecture:** Pure `RPGVisual` formatter + HTML/CSS integration into existing VN window, no gameplay changes.

### Task 1 — Pure verified visual model
- [ ] Write failing unit tests `tests/rpg-visual.test.js` for real terminal effects, intermediate/unknown branch, deterministic sanitized HTML, actual NPC bond and no NPC fallback, 3d6 percent.
- [ ] RED then implement `js/ui/story-impact-ui.js` and script load after story engines/NpcSystem but before ui.js.
- [ ] GREEN and no state mutation.

### Task 2 — Live slip integration
- [ ] Write failing VM and browser assertions for choice odds meter, effect chips, guaranteed third choice, actual 3d6/dice outcome, accessible scene progress, reduced motion and keyboard.
- [ ] Add minimal markup in `js/ui.js` and scoped CSS in `css/story-rpg.css`. Preserve native `data-vn-opt` and one-shot roll action.
- [ ] RED→GREEN, full tests, world/NPC diagnostics, static audit/simulator, Chrome 320/390/768/1440.

### Task 3 — Delivery
- [ ] Verify `git diff --check` and 0 protected map files; commit evidence.
- [ ] Push PR, merge only with green tests and re-run tests on exact master.
