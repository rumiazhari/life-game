# Phase 12 TDD and release verification plan

> Use Superpowers test-driven-development and verification-before-completion.

1. **RED — Save contract and robust rehydration.** Add `tests/life-file-save.test.js`: pure snapshot/parse with deterministic bytes and FNV checksum, corruption/oversize/schema/structural rejection, no mutation, World+NPC+RPG/StorySystem migration, active 3d6 story continuation and duplicate filing, save after annual-energy use, new World vs imported World, record-bound stability.
2. **GREEN — Pure save engine** in `js/systems/life-file-save.js`, loaded after canonical systems and before story UI. `LifeFileSave.prepare` reuses existing migrations.
3. **RED→GREEN — Player interface.** Add UI tests for local save/export/import controls, status, file type/size validation and call to main restore. Integrate in `js/ui/story-quest-ui.js` and `main.js` with rollback-safe canonical swap; minimal responsive CSS.
4. **Release QA runner.** Add `tools/rpg-release-qa.js` and `tests/rpg-release-qa.test.js`; run 100-year deterministic archive/snapshot/memory stress (without inventing human playtests), report measured heap/time and thresholds, and true save/new-game/continuation snapshots. Generate `reports/rpg-release-qa.json`; build release notes.
5. **AEROMI gates.** Full npm test, both RPG tools, world/NPC diagnostics, new integrity and release audits, node --check, browser Chrome at 320/390/768/1440 (save/export/new-file/load/click-continue/fast-forward, keyboard and reduced motion), clean tree and zero protected map changes. Commit, push PR, merge only when all pass, then rerun full tests on **exact merged SHA** and update Issue #24 checklist.
