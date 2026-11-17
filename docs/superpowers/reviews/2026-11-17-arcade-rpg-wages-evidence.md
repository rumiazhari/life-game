# Arcade RPG — Missing Wages Verification Evidence

**Date:** 2026-11-17 (JST)  
**Base commit:** 3df761f0dd4f0fa8f437a68b5a94351a883f8577  
**Feature branch:** feat/arcade-rpg-wages-20261117  
**Scope:** existing StorySystem/RPG integration only; no map development changes.

## Implementation evidence
1. Existing background choice and perk selection are visible in the Stories panel; RPG APIs remain authoritative.
2. First wage story and its follow-up reserve one existing annual action-energy on start. Dialogue and rolls use no extra energy.
3. Original business **and original employment contract ID** guard prospective raises. A new employer, or a later contract at the same business, cannot inherit that reward. Wage dialogue distinguishes future salary increases from arrears repayment.
4. Wage-story RelationshipMemory includes the bound coworker NPC's persistent ID when present; missing coworker uses the current safe fallback.
5. Completed main wage chapter grants 60 merit once; grade II admits an existing earned perk. Unfinished filing is rejected. Next-year aftermath remains a separate playable follow-up.

## Tests actually executed
- Baseline before edits: **977 passed / 0 failed**, native `npm test`.
- Task 1: new background/perk tests failed against old UI, then passed. Full suite: **980/980**.
- Task 2: cost/no-energy/shared-ledger tests failed against original code, then passed. Full suite: **983/983**.
- Task 3: real coworker and employer-switch regressions failed, then passed. Full suite: **985/985**.
- Task 4: 60-merit, early filing and continuation tests failed, then passed. Full suite: **988/988**.
- Final contract-ID edge case: rehire at same company failed before guard, passed afterward.
- Final `npm test` on current worktree: **989 passed / 0 failed**.
- `npm run diagnostic:world`: exit code **0**.
- `npm run diagnostic:npcs`: exit code **0**.
- `node --check` on all five modified JavaScript files: exit code **0** each.
- `git diff --check`: exit code **0**.
- Headless Chrome live UI with new adult subject, real employer, Stories panel and background selection: **PASS** at **320, 390, 768 and 1440 px**. At every width, document, story sheet and wage story card scroll widths were at most client widths. The one-energy story cost was visible.

## Map protection evidence
The diff against baseline contains only:
- `css/story-rpg.css`
- `js/systems/story-quest-engine.js`
- `js/systems/story-quests.js`
- `js/systems/story-system.js`
- `js/ui.js`
- `js/ui/story-quest-ui.js`
- `tests/story-arcade.test.js`
- documentation in `docs/superpowers/**`

**Protected map paths modified: 0**. Existing `tests/lithuania-25d-map.test.js` remained in the full 989-test suite; no protected branch was merged or reset.

## Remaining gate and reviewer limitations
- **A10 human enjoyment/agency:** Not tested. The 6–8-person formative study, medians and comprehension targets must be evaluated separately; unit tests do not establish that the design is fun.
- **Review:** Author self-review and actual test/diagnostic/browser evidence only; no independent reviewer dispatched.
- **Deployment:** No merge to `master` and no automatic website deployment. Changes are held on the isolated feature branch for review.

## Intentional design rulings
- Retain 3d6 and the current chapter/merit/perk model rather than introducing D20, separate XP, a new GoalSystem or a second action resource.
- Spend one annual action at chapter entry, not per dialogue, so chapters cannot trap players mid-encounter with zero energy.
- Apply paid chapter starts only to the first wage slice; other quests preserve current cost semantics pending later integration.
- Keep the 60-merit introductory reward as a provisional tuning constant until real player sessions establish whether it supports pacing.

