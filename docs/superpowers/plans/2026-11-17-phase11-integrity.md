# Phase 11 Implementation Plan — inspectable RPG integration report

> Superpowers: TDD, code review, verification-before-completion. Follow Issue #24 exact gates.

1. Inspect existing simulator and diagnostics (done). Write failing unit/CLI tests in `tests/rpg-integrity-report.test.js` for seed sessions, source provenance, exact-vs-sample tolerance, energy/merit, contract salary invariants, malformed options/softlocks, HTML consistency. Observe RED.
2. Implement pure `tools/rpg-integrity-core.js` and `tools/rpg-integrity-report.js`. Reuse actual `rpg-playtest-audit` and `rpg-scenario-playtest` by child process, freshly execute both and parse JSON; do not replace their arithmetic. The dynamic scenario harness lives in new report CLI and uses normal VM gameplay APIs, no production save mutation. HTML report uses only escaped data from report.
3. GREEN tests. Run `npm run report:rpg` to create `reports/rpg-integrity.json` and `reports/rpg-integrity.html`; validate these match and are deterministic. If violations, repair only proven faults and re-test.
4. Fresh full `npm test`, `audit:rpg`, `simulate:rpg`, `diagnostic:world`, `diagnostic:npcs`, syntax, real headless Chrome at 320/390/768/1440, `git diff --check`, zero map files. Commit evidence, push PR, merge after green, test exact merged master.
