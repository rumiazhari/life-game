# Phase 6 validation

Base: c6fa7eb. Runtime reviewed: 91132c6. PR #25.

- TDD: 5 initial failures then passes; 3 independent review findings reproduced RED then fixed GREEN; reputation regression RED then GREEN. Focused suite 11/11; full npm test 1056/1056, zero failures on Linux and AEROMI Windows.
- audit:rpg, simulate:rpg, diagnostic:world, diagnostic:npcs: exit 0 on Linux after final runtime changes. Existing audit/simulator cover authored chapters; new dynamic-family coverage is the focused suite including two deterministic eighty-year runs and a 64-entry archive bound.
- Chrome headless on AEROMI: actual story-board start, next, guaranteed choice and file controls at 320/390/768/1440 px; exactly one archive and energy charge per run, zero horizontal overflow and page errors. Automated fixture gameplay, not human playtesting or physical Android-device testing.
- Independent reviewer identified callback entity drift, subject household departure, and stale-year mutation. All three reproduced and fixed with regression tests. Additional standing test verifies canonical S.relations affects difficulty.
- node --check and git diff --check pass. Protected map-file changes: 0.
- Browser launch in cloud execution environment failed on denied socket creation; AEROMI Chrome was the successful fallback. Windows npm required process-local npm_config_script_shell=C:\Windows\System32\cmd.exe; no persistent configuration changed.

Design ruling: generated definitions are transient; durable scenes/context remain in StorySystem runs/archive, with three fixed family high-water years. No second entity or relationship authority. Existing authoring catalogue remains twelve chapters. Callbacks are offered only for matching canonical entities and after the prior resolved year. No wage changes, additional balances, or map edits.

Limitations: replay tests exercise generated encounters independently from annual population mortality; broad annual diagnostics cover the existing engine. No human enjoyment claim or public deployment verification.
