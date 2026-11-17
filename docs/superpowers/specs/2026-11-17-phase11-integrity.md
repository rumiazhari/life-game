# Phase 11 — Quantitative Integration, Economic and Choice Integrity

**Base:** verified master `cc97a864d7e5624419cf8b496bb197f959367f86`. **Branch:** `feat/rpg-phase11-diagnostics-tuning-20261117`. Reference: GitHub Issue #24 Phase 11.

## Existing authority and actual gaps
The repository already has a 12-chapter authoring audit (`tools/rpg-playtest-audit.js`), 180 scripted authoring playthroughs (`tools/rpg-scenario-playtest.js`), and a voluntary, nonvalidated in-game three-question playtest. These do not produce a **unified inspectable reproducible report** combining exact 3d6 odds versus seeded samples, choice/escape softlocks, annual energy and merit, dynamic cross-domain events, and economic invariants. The older reports were historically authored on Phase 5 code and require explicit provenance if reused.

Create one deterministic and **read-only** `tools/rpg-integrity-report.js` CLI combining freshly executed authoring and playthrough reports with instrumented dynamic gameplay across seeds, a distinct 216-outcome exact vs synthetic-sample probability table, and real StorySystem/EmploymentSystem snapshots. Expose a machine-readable `--json` report and a self-contained `--html <path>` static dashboard, whose values come only from that report. Every statistic must declare denominator and `automated_simulation_not_human_playtest` provenance; do not claim user enjoyment.

## Synthetic scenarios
For each seed, set up a reproducible real business and living connected NPC using BusinessSystem, NpcSystem and authoritative relationships. Use clearly labeled **seeded prerequisite archive fixtures** for employer/civic/social/night-market already-completed stories, so two dynamic Phase 9 chains are reachable. Exercise both families' first and follow-up stages with safe and check-seeking policies; use StorySystem start/next/choose/fileAway, unique run IDs, canonical 3d6 checks and one-energy starts. Require all paths to terminate in ≤32 actions, maintain 3d6 preview/resolution bounds, preserve real employment contract and salary, avoid changing `S.assets` on safe choices, never duplicate archive/merit, preserve real NPC identity, and keep all World/StorySystem invariants clear. Include early missing-NPC, no-energy and stale-year probes to identify softlocks. Existing `audit:rpg` and `simulate:rpg` remain independent gates.

## Acceptance
- A CLI report with >=2 seeded policies × >=5 seeds × 2 chains × 2 stages = >=40 machine-controlled sessions, exact per-case evidence and aggregated percentages, 216-outcome analytical model vs ≥1200 independent seeded trials/difficulty, both negative and positive dice checks.
- Faithful HTML with tabular bars/quantities, no external CDN or network dependency, privacy-safe seed and synthetic provenance.
- Additional tests for valid report schema, reproducibility, safe-fallback, merger of authoring report, scenario budget/merit/contract invariants, report failure on deliberately injected softlock, and keyboard/mobile HTML rendering on 320/390/768/1440. No made-up player ratings or economic data.
- Do **not** retune probability, economy or merit on preference alone; only make changes when the report identifies reproducible violations. Preserve protected maps and concurrent branches.
