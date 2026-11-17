# Life File — Phase 2 Contextual Arcade Actions Design

**Date:** 2026-11-17
**Baseline:** merged master f4f619657c309afe1f88245713b9cc1a94cbf68f
**Branch:** feat/arcade-rpg-contextual-actions-20261117
**Scope:** Work, Learn, Connect, Recover, Risk in the existing Priorities / immediate-action flow

## Goal
Ordinary annual actions should feel like a fast RPG loop without extra confirmations, second currencies, independent skill trees, or new simulations. Five compact, visual category tiles point to real existing actions. Eligible mapped actions resolve an additional 3d6 **execution-quality** check through the canonical RPG engine, show exact odds in advance, and include concise dice results and small bounded consequential adjustments in the existing action receipt.

## Current integration seam
`js/ui.js` owns `focusSituationHtml`, `renderPlan`, `triggerAction`, `performActionNow` and authoritative `markActionDone/energyUsed`. `PUR_MAP`/`DEC_MAP` in `js/data.js` own existing avail/cost/apply effects. `RPG.previewCheck`/`RPG.resolveCheck` in `story-rpg-checks.js` own exactly 216 combinations and trait/health/skill modifiers. The game already has priority recommendations, ordinary action receipts, bounded stats, and a fully merged 2.5D map. Preserve them.

## Architecture
Create `js/systems/contextual-actions.js` as a small pure adapter, loaded after `story-rpg-checks.js` and before `ui.js`; it declares five family candidates, selects the best **eligible, not already used** real action from the existing registries, previews its quality check, and resolves that check with `WorldSimulation.streamFor(world,year,'context:'+type+':'+id,'arcade-actions')`. The adapter never stores a second action log; the existing `__doneActions[year]` guard prevents repeated attempts. Base actions execute exactly once through `performActionNow`; successful/failed quality effects are merged into their existing `fx` and applied once via `applyFx`. No alternate bet resolution, workplace promotion, vacancy allocation, medical treatment, wage settlement, or family system is introduced.

## Five action families
| Family | Candidate priority | Optional quality check | Additional bounded effect |
| --- | --- | --- | --- |
| Work | `overtime`, then `lookwork` | labor, standard on overtime only | good +$50; setback -1 health; native wages/shift remain authoritative |
| Learn | `study` | study, standard | good +2 smarts; setback no extra penalty |
| Connect | `tendspouse`, `family`, `court`, `writemother`, `writefather`, `meetsomeone` | social, standard on direct interactions only | good +2 relations; setback base interaction still occurs |
| Recover | `walk`, `doctor`, `rest` | grit, standard on walk only | good +2 health; setback base recovery still occurs |
| Risk | `track`, `bottle`, `crime` | hustle, hard on track only | good mitigates existing loss by $75 or adds $40 to native win; setback -1 happiness; **not** the 50/50 bet result |

Fallback entries with complex pickers or existing native rolls remain exactly as they are; no artificial 3d6 overlay on job allocation, treatment, random crime or meeting strangers. The 3d6 label explicitly describes **quality/handling odds**, not probability of landing a job, winning at the track, or getting a relationship.

## UX contract
- Priorities shows five responsive cards with category SVG, existing action label, cost, and exact quality odds where applicable; no 3d6 roll on an unconfigured fallback.
- One click uses `triggerAction`. Contextual cards for pickers still use the original picker, not a forced immediate apply.
- Unavailable/no-energy/custody/used actions are disabled with a terse reason; alternative candidate within a family is chosen when available.
- Action receipt adds an inline three-dice, success/setback outcome and modifier; base action and additional effect are visible in standard delta chips.
- Existing priority advice, Pursuits/Decisions tabs, annual actions, fast-forward, save migration, maps, and accessibility remain intact.
- Responsive at 320, 390, 768, 1440 px, with reduced-motion styles.

## Acceptance
A1: Exactly five family tiles, each anchored to real eligible registry actions; exhausted, age-gated, already-used and custody cases are guarded.
A2: Quality odds preview equal 216-state resolver for given character; skill, background, health and perks change them.
A3: Deterministic 3d6 rolls on the same seeded world/year/action; repeated action in a year does not earn a second quality reward or consume energy again.
A4: Native actions remain once-only, same cost, existing economics/medical/social effects; 3d6 adjusts only the small policy bonuses above.
A5: Betting's 50/50 remains the underlying bet; displayed 3d6 percent explicitly refers to risk handling, not winning.
A6: UI receipt exposes dice, result, modifiers and consequences without an additional modal.
A7: No changes to protected `js/map.js`, `js/state.js`, `js/systems/world-gameplay.js`, `assets/maps/**` or existing map branches.
A8: `npm test`, `npm run diagnostic:world`, `npm run diagnostic:npcs` and live browser width checks pass; no guarantee about subjective fun until human playtesting.

