# Phase 12 — Saves and Release

**Status: PLANNED.** No code for this phase exists yet — the game currently
has no save/load system at all; `World`, `S`, `Lineage`, and `Hold` live
only in memory for the duration of a browser session (only `Archive` and
`Achievements`, in `js/state.js`, currently persist to `localStorage`, and
only across-life summary data, not full game state). Every file, API, and
state shape below is a plan.

- **Dependencies:** every other phase — the save envelope must serialize
  whatever state exists at the time this phase is built, so it is
  necessarily last, and each earlier phase's `migrate` function is what
  makes old saves loadable after the game changes.
- **Completion criteria:** see the end of this page.

## 12A — Save envelope

Planned envelope fields: format identifier, save-format version, save ID,
save name, created/updated timestamps, game version, arbitrary metadata,
plus the actual state: `S`, `World`, `Lineage`, `Hold`, and a checksum.

## 12B — Storage

Planned storage split:

- `localStorage` — settings, achievements, and slot metadata (extending the
  existing `Archive`/`Achievements` pattern already in `js/state.js`);
- `IndexedDB` — complete save envelopes (localStorage's size limits are not
  suitable for full `World` state at scale, especially post-Phase-9
  multi-generation saves);
- JSON export — manual backup/restore, human-inspectable.

Planned API:

```
// PLANNED
SaveSystem.save(envelope)
SaveSystem.load(saveId)
SaveSystem.list()
SaveSystem.remove(saveId)
SaveSystem.rename(saveId, name)
SaveSystem.export(saveId)
SaveSystem.import(data)
SaveSystem.recoverAutosave()
```

## 12C — Migration registry

The save loader calls each system's own `migrate(world, ...)` API (already
the standard shape per
[Engineering Rules](ENGINEERING-RULES.md#standard-lifecycle)) in the same
order `WorldSimulation.migrate` already calls them
(`BusinessSystem.migrate` → `EmploymentSystem.migrate`, etc., extended with
every later phase's system). `SaveSystem` must not duplicate any system's
own migration logic — it only needs to call `WorldSimulation.migrate(world)`
(which already fans out to every registered subsystem) plus any top-level
fields outside `World` (`S`, `Lineage`, `Hold`) that need their own repair
pass.

## 12D — Corruption recovery

Planned: maintain the current autosave, the previous autosave, one
temporary "verified write" slot (written, read back, and validated before
promoting it to the current autosave), and manual saves, so a corrupted
write never destroys the only copy of a save.

## 12E — Import safety

Planned checks on any imported save: schema/shape validation before
touching live state, size limits, rejection of any executable content
(saves are pure JSON data, never `eval`'d or otherwise executed), in-memory
migration before it becomes the active state, a full `checkInvariants` pass
across every system after migration, surfaced repair warnings if invariants
had to fix anything, and an explicit overwrite confirmation before replacing
an existing slot.

## 12F — Release packaging

Planned: Progressive Web App manifest, a service worker for offline play,
installable-asset packaging, and — only after the browser experience is
stable — an Android wrapper (e.g. a WebView-based shell) around the same
plain-JS game. Do not rewrite the game in a different language merely to
target Android publishing; the constraint from
[Repository Architecture](REPOSITORY-ARCHITECTURE.md) (plain scripts, no
framework) is expected to hold through this phase too.

## Suggested version sequence

```
0.4.x  — businesses and employment (Phase 4C)
0.5.x  — government and law (Phase 5)
0.6.x  — advanced health and reproduction (Phase 6)
0.7.x  — event chains (Phase 7)
0.8.x  — property and credit (Phase 8)
0.9.x  — inheritance and dynasty (Phase 9)
0.10.x — national history (Phase 10)
0.11.x — polish and balance (Phase 11)
0.12.x — save management (Phase 12A–12E)
1.0.0  — release candidate (Phase 12F)
```

## Planned tests

`tests/save-system.test.js` covering: round-trip save/load equivalence,
migration of a save from an earlier schema version, corruption-recovery
fallback to the previous autosave, and import-safety rejection of malformed/
oversized/invalid saves.

## Completion criteria

- A save can be created, listed, loaded, renamed, deleted, exported, and
  re-imported with no data loss and no invariant violations.
- Loading a save from an earlier schema version correctly migrates through
  every system's own `migrate` function.
- A corrupted write never loses more than the single most recent autosave.
- An imported save cannot execute code or bypass invariant/migration
  validation.
- The game remains installable and playable offline as a PWA before any
  Android packaging work begins.
