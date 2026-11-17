# Phase 12 — Release readiness verification on AEROMI

**Date:** 2026-11-17 JST. **Base master:** `69b05350874449034a4941e40aa4fb37a2c93764`. **Feature branch:** `feat/rpg-phase12-release-readiness-20261117`.

## Implemented release candidate

- Added **manual, local-only current-life backup/restore** in `LifeFileSave`, with JSON schema `life-file-save-v1`, 20-MiB size/structure bounds, noncryptographic FNV-1a corruption detection, object consistency checks and detached canonical migrations. No network/autosave or cross-life archive/achievement replacement.
- Added **EXPORT SAVE / IMPORT SAVE** buttons inside Stories and a direct **SAVE FILE** control in an ongoing visual-novel scene. Export downloads unencrypted local JSON through Blob/File URL; import uses a local file picker, rejects malformed/corrupt/oversized/mismatched files, retains original World/S/Lineage/Hold/followups and ongoing StorySystem run on success.
- `main.js:restoreLifeFileSnapshot` completes pre-validation/preparation before swapping canonical state references, refreshes the dossier and live Stories view, and attempts rollback if UI refresh fails. No map/state/world-gameplay source was edited.
- Added `npm run release:rpg:qa` and `tools/rpg-release-qa.js` with reproducible QA evidence in `reports/rpg-release-qa.json`, plus release notes in `docs/releases/2026-11-17-rpg-phases-6-12.md`.

## Observed TDD and full test gates

- Focused RED (new save tests initially failed due missing LifeFileSave and UI controls, release runner absent). GREEN: **8 save/recovery tests**, **4 release runner tests** covering deterministic save export, checksum, schema/size/subject mismatch, 3d6 story continuation after a new game, one-time merit and idempotent migrations, and in-scene save.
- Fresh `npm test`: **1,112 passed, 0 failed**.
- `npm run audit:rpg`, `npm run simulate:rpg`, `npm run diagnostic:world`, `npm run diagnostic:npcs`, `npm run report:rpg`, `npm run release:rpg:qa`: all **exit 0**. Syntax checked modified `js/main.js`, `js/ui.js`, `js/ui/story-quest-ui.js`, `js/systems/life-file-save.js`, and `tools/rpg-release-qa.js`: **exit 0**.
- **Release stress** (`reports/rpg-release-qa.json`, Node VM): 3 seeds × 2 repeat runs × 100 synthetic years = **600 aging/migration/snapshot cycles**, **6/6 resumed active stories**, **3/3 deterministic replays**, **5/5 malformed/tampered/unsupported/oversized saves rejected**, zero recorded failures. Last measured wall time **11,497.66 ms**, maximum individual cycle **30.67 ms**, largest snapshot **64,824 bytes**. Node heap observed at start **4,261,416 bytes**, peak **50,214,448 bytes** (sampling only at run boundaries), end **50,214,448 bytes**. Limits: 120,000 ms total, 1500 ms/cycle, 20 MiB/snapshot, 384 MiB heap. The synthetic year loops perform migrations and bookkeeping, **not** the complete annual mortality/childbearing game path.

## Actual headless Chrome E2E on AEROMI

The browser loaded the real `life-game.html` from local HTTP and:
1. Clicked **OPEN** and skipped the normal intro (new 0-year subject).
2. Set a deterministic adult player fixture and started an actual civic contextual story through its **Stories card**: annual energy **0→1**, active run `story:00001`, in-scene save button present, JSON **65,565 bytes**.
3. Clicked in-scene **SAVE FILE**; current story scene stayed `open`.
4. Started another **newFile**; a different subject existed with no active story.
5. Used a real browser File object/chooser/change event to **IMPORT SAVE**. Same original World seed, NPC, year, run `story:00001` and energy=1 were restored. **CONTINUE** appeared.
6. Tested malformed JSON through the same file input. UI displayed **IMPORT REJECTED · malformed_json**, and the active World/S/Lineage/Hold remained byte-identical.
7. Clicked **CONTINUE**, took the guaranteed third route, filed the completed `context_decline` ending, received exactly **20 merit** and left zero active runs, with annual energy still one.
8. Invoked actual `fastForward()`: one calendar year advanced (**28→29**) before the UI/stopping condition, with StorySystem invariants remaining empty; wall time **168 ms**, measured Chrome heap ~**6.4→6.5 MiB**.
9. Inspected import/export control widths and page/sheet overflow at **320, 390, 768 and 1440px**: no horizontal overflow at any width; import button received keyboard focus.

These are genuine browser interactions with a synthetic adult prerequisite fixture. They are **not** human playtest observations, a physical Android hardware run, a full 15-year gameplay fast-forward, or a public deployment. The browser save button generated a local Blob/file link and showed preparation status; OS-level downloaded-file persistence was not separately asserted.

## Release boundaries and exclusions

- **No public deployment**, app-store build, or release publication was performed. Physical Android hardware, device touch behavior, cross-browser storage constraints, and long-session performance remain untested.
- Manual saves are **unencrypted**, not tamper-resistant cryptographic signatures. The checksum detects accidental corruption, not deliberate malicious edits with recomputed checksums.
- All story/world data are synthetic; no voluntary human enjoyment/agency ratings were gathered or inferred. No gameplay balancing changes were justified by test evidence.
- `git diff --check` must be clean and protected paths `js/map.js`, `js/state.js`, `js/systems/world-gameplay.js`, `assets/maps/**` unchanged. One separate feature PR, merge and final exact-merged-SHA tests follow this evidence.
