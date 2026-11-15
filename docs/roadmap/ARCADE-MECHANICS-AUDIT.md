# Life File: mechanics audit and simplified arcade RPG structure

2026-11-15. DESIGN/AUDIT ONLY. Baseline: master 32137794659fbd728211bda5a4dc553529b299bb; gameplay source is unchanged from f937d029f571254be388941656e88c88adc01aeb.

This revision takes priority over RPG-GAMEPLAY-DESIGN.md where that earlier proposal adds goals, progression or UI complexity. First simplify the existing game; do not build the earlier new GoalSystem before the prototype below is evaluated.

## Scope and evidence

Repository-wide source inventory covered the core, state, data, education, map, medical adapters, UI, all 26 systems modules and the employment UI. Inspected mechanic definitions, exported APIs, mutation/annual integration paths, action resolution and representative tests. Art/map rendering is presentation, not an independent mechanic. This is a static mechanics audit, not an assertion that every branch was played or every source line formally reviewed.

Runtime catalogue extraction through the existing VM loader counted:
- 24 pursuits and 34 decisions: 58 base action definitions.
- 20 gig variants, 18 career tracks, 23 generic job entries, 10 skills.
- 107 ambient event definitions, 25 crisis definitions, eight petitions, three opportunities and 11 story episodes.
- Seven dispositions, seven intents, seven housing choices, four food choices and three childcare choices.
These are catalogue counts, not the number simultaneously available to a player. Dynamic target pickers, school choices, medical treatments, Bureau desk actions, Hold actions and map interactions add further entry points.

Action mapping below was checked against the actual arrays: 58 mapped, zero missing, zero duplicates, zero unknown IDs. No gameplay tests were needed or run for this documentation-only change. No player enjoyment measurements exist yet.

## 1. Current mechanics map

| Mechanic family | Current source/behavior | Keep, simplify or change |
|---|---|---|
| Time and agency | computeHours gives 0–4 actions based on age, health and disease; normal actions resolve now; queue mainly supports autoplay | One visible action budget; eliminate pursuit/decision distinction from UI |
| Core stats | Health, happiness, smarts, looks; relations, freedom, scrutiny and security fields also gate outcomes | Health and happiness remain visible; skills on demand; looks becomes a trait/context detail |
| Income and jobs | Business registry, employment contracts, vacancy competition, promotion, salary, pensions, layoffs | Salary automatic; one job card with next advancement requirement and optional extra effort |
| Informal income | Generic gigs, crime ladder, fixer openings and Hold operations use separate risk/reward paths | One opportunities browser; distinguish guaranteed work from explicitly risky operations |
| Education | Institutions, major, funding, age stages, credentials, skill caps, skill floors and passive training | One learning project view; qualifications unlock access, practice builds relevant competence |
| Skill progression | Ten skills, smarts-based training rate, education ceilings, reinforcement and decay | Keep skill identity; remove routine decay from the first simplified prototype after save-safe migration |
| RPG layer | Merit, eight grades, three backgrounds, ten perks, six domains and 3d6 resolver | Resolver/background/perk-unlock APIs currently have no gameplay callers in js; hide the disconnected meter until useful unlocks are wired |
| Relationships | Per-contact mood, parents, partner, children, household, NPC registry, relationship memory, affairs | One person card, one bond display and relevant memory; connect actions target a named person |
| Medical | Exposure, diagnosis, conditions, treatment, mortality, access, family treatment and caregiving | Auto-maintain established treatment under a chosen policy; decisions for diagnosis, unaffordable care or changed prognosis |
| Lifestyle and debt | Housing, food, childcare, installment liabilities, school debt, medical debt and household finance | One budget view with income, total outgoings and pending exceptional bills; settings persist |
| Geography | Settlement economy, surveillance, travel routes, fares, travel next-year arrival, buildings, local services | Map is destination/opportunity selection; walking through decorative buildings adds no action cost |
| Government and law | Regime posture, scrutiny, favors, legal cases, administrative detention, legacy jail timers, permits, protest waves | One contextual Bureau file view; distinguish investigation, conviction and detention instead of merging their state |
| Childhood | Guardianship, warmth, toxicity, milestones, eviction, school decisions, state care and hearings | Quick childhood setup by default, full childhood optional; retain meaningful childhood outcomes |
| Hold | Members, loyalty, trust, funds, supplies, districts, heat, quiet/fortify actions and operation crises | Optional risky organization path; no separate full management dashboard in the prototype |
| Events | Ambient events, petitions, crises, opportunities, notices, followups and branching story episodes | One event presentation; routine notices become a short receipt; major decisions remain interactive |
| Progress and scoring | Inferred intent, inferred disposition, Bureau A–F assessment, intent stars, merit grade, streaks, achievements | One player-selected existing intent for progress; Bureau assessment is explicitly a separate epilogue opinion |
| Death and succession | Close employment, record life, select eligible kin, carry world and household history onward | Preserve continuity; make a life/chapter ending a satisfying stopping point |
| Archive and achievements | localStorage stores completed files, achievements and sound preference | Optional records screen; persistence here is not proof of a full active-world save system |

Distinctness means different primary decisions, not disconnected systems. Work can fund treatment; a friend can enable an application. Those interactions are valuable. Two buttons with the same target, cost, timing and type of result should share a command unless their tradeoff is understandable.

## 2. Concrete overlaps and misleading mechanics

1. court, tendspouse, tendcontact, writemother, writefather and tendmember are variations of spend time to raise a bond. family raises a family-wide mood. Replace their separate navigation with Connect -> person/group; role supplies the text and eligible encounters. Preserve differences that matter, such as caregiving versus companionship.
2. overtime and nightshift both turn one action into cash at a health cost. Current overtime pays 200 + 120*jobTier with -3 health/-3 happiness; nightshift pays 400 with -3 health. Make Extra Shift one contract-aware choice; shift differences belong in employer content.
3. walk grants +3 health/+2 happiness for one action; rest grants +1 health/+2 happiness for zero, once yearly. Rest is not an infinite exploit: it is explicitly once per year. However, its guaranteed free gain encourages a maintenance click. Incorporate ordinary rest into annual defaults; reserve Recover for a meaningful intervention.
4. doctor and desk checkup both examine and grant health, at different prices/cooldowns. treatment is yet another entry. Present one Care workflow; institutional orders arrive as events rather than a second clinic.
5. generic crime, criminal gigs and fixerjob overlap in money/capture consequences. Their distinct potential is stake selection, local availability and patron obligations. Show these dimensions in one operation card.
6. loan grants 2,000 immediately and schedules a venture profit/loss in three years, but adds no installment liability. bankloan and storecredit do create liabilities. Retire loan from new menus or convert it to an actual business financing offer; do not call free venture cash a bank loan.
7. gamblelic grants 800 and vice immediately without registering a business. foundBusiness creates a real employer and transfers 5,000 into it. Route gambling ownership through BusinessSystem or make the former a clearly labeled event payment.
8. relocate sets didCoast and stat effects but does not change settlement. Real travel is scheduleTravel/resolveTravel. Merge this into the real movement path; distinguish vacation from moving residence.
9. expunge, usefavor and bribeBureau offer overlapping record/scrutiny relief. One Resolve Bureau Problem card can expose cash, an earned favor or a risky bribe as alternatives with distinct legal consequences.
10. currentIntent chooses the highest-scoring intent from state rather than storing a deliberate ambition. This can switch the apparent objective. Use an explicit selected intent for player progress; retain inferred disposition as flavor.
11. grade rewards marriage, children, long life and conformity, whereas intents include staying unbound or burning bright. Displaying both as universal success criteria sends contradictory signals. Keep Bureau judgment in the epilogue, not as the live player objective.
12. RPG.resolveCheck, unlockPerk and setBackground occur only inside rpg-system.js in runtime source. Tests exercise them; gameplay does not call them. Adding another progression layer now would deepen that gap.
13. Normal actions already call performActionNow and resolve immediately. Do not advertise “instant actions” as a new implementation. The remaining issue is where feedback appears and how many screens/actions compete.
14. Year report uses the first six yearLog entries, revealing them at roughly 420 ms intervals. Prioritize player consequences, goals and threats rather than chronology; show a compact receipt immediately.
15. Custody has multiple representations: legal cases, detentions/detainedUntil, jailUntil and legacy operation followups. These have distinct meanings but need a single eligibility adapter before any UI simplification. Do not merely rename them into one meter.
16. bureauPermit currently affects detention duration; scheduleTravel/resolveTravel do not read permitUntil. Clarify this behavior or integrate the permit with actual travel rules before describing it as opening the road.

## 3. Proposed playable structure

The core screen has: character, remaining actions, cash plus next-year net budget, health, happiness, current intent and one relevant situation. People, work and skills expand only when used. Bureau attention appears while relevant. No fullscreen dossier is required between ordinary actions.

Prototype cadence:
- Adult character: three discretionary actions per year.
- Children age 6+: two actions in full childhood mode; infancy advances through a compact summary.
- Elder characters retain three actions in the first prototype. Illness modifies feasibility, effectiveness and recovery needs rather than silently stripping the player of all recovery actions.
- Legal custody uses a clearly described restricted action set. Even a detained or gravely ill character needs a feasible response or explicit automatic-care resolution.
- One ordinary major encounter per year; urgent legal/medical consequences cannot be dropped to meet that limit. Batch informational notices and serialize genuine emergencies.
- End Year settles salary, bills and the world once; returns a three-line prioritized receipt.
- No reaction timer. Arcade feeling comes from fast, readable decisions and results. Decisions involving long text remain untimed.
- Prototype pacing target: 30–60 seconds for a routine year, adjustable by player. This is a proposed target, not measured current performance.

## 4. Five action families with different jobs

| Action | Primary decision | Unique result | Cost/risk |
|---|---|---|---|
| Work | Stable job, extra shift or better opening? | Income and career access | Extra effort trades health/happiness against pay; applications consume scarce opportunity |
| Learn | Which qualification or skill opens the next route? | Permanent competence or access | Time, tuition and relevant prerequisites |
| Connect | Who deserves time, and what commitment will I make? | A named relationship or reciprocal obligation | Time and competing loyalties |
| Recover | Rest properly, seek care or arrange support? | Relief from a specific health/wellbeing problem | Time, bill, or accepting help |
| Take a Risk | Which stake can I afford, and do I stop now? | A contingent payoff or setback | Disclosed exposure and potential loss |

These are five families, not five equally good stat-heal buttons. Display no more than three suggested concrete actions on the first screen, with a stable More button exposing all feasible alternatives. Suggestions are not a random hand: never hide the only cure, debt response or goal route.

Work salary continues automatically even if no Work action is selected. Work actions concern extra effort or a change in employment, not paying an action tax to receive contracted wages. Learning progress can be displayed in a few milestones without changing the duration or credential requirements of medicine, law or other current courses.

Connect should not become a button that generates favors from strangers. For example, a colleague may provide an introduction after shared work; repaying their request costs a later action. Store this using existing people and relationship memory plus a specific obligation record only where the current schema lacks it.

Recover is not universal cure. Healthy characters can restore happiness through leisure; illness needs appropriate treatment. Continuing an affordable established treatment should not require manually visiting the same menu every year.

## 5. Distinctive mechanic: stop or continue an operation

Use the existing gigs/fixers/Hold setting for an explicit sequence:
- Choose a listed operation and a disclosed stake.
- Resolve one stage; earned payout remains pending in that operation.
- Choose Cash Out or Continue. Continuing consumes another discretionary action and changes the shown risk/payoff.
- Failure applies only that operation's disclosed losses; it cannot silently confiscate unrelated lifetime assets.
- Maximum three stages in the prototype. Ending the year automatically cashes out at the last offered safe value unless an explicit authored rule requires resolution first.
- A legitimate gig can still be a guaranteed one-step job; it need not use the risk sequence.
- The player's scrutiny and the organization's heat remain different authoritative facts. Show “Your attention” versus “Group exposure” in the relevant detail; do not add a third universal heat currency.

Illustrative balancing fixture only: stage-one return 100; continue succeeds with 0.70 probability and replaces it with 200, otherwise pending payout falls to zero. Expected pending payout from continuing is 140 versus 100 on cash-out, before pricing the action and any additional consequence. This is not a claim about current payouts or a final balance recommendation. The UI must show actual data, not these example numbers.

The appeal to test is a clear choice under uncertainty, not an assumption that gambling automatically makes the game fun.

## 6. Distinctive mechanic: a promise that changes an option

Each important person may have one visible unresolved commitment in the prototype. Keeping it opens a concrete response; breaking it changes their behavior and leaves a readable memory. Example: repay a colleague's shift cover -> they introduce a supervisor; ignore the commitment -> that introduction is unavailable and their dialogue explains why.

This makes Connect different from Work: it changes another person's willingness and obligations, not employment status directly. The introduction can improve access; the authoritative vacancy system still decides hiring. No hidden automatic hiring shortcut.

## 7. Development without another grind

Use the ten existing skills as the single competence vocabulary. Do not add six parallel RPG domain bars. An internal resolver can map an action to its actual relevant skill, declared circumstance and relationship contribution; test each mapping before use.

For the initial slice, hide the unused merit-grade display. Award the first meaningful specialization choice on completing the first relevant chapter milestone. Offer two mutually distinct capabilities, such as learning an alternate negotiation response versus preparing a safer operation. Both need real callers and authored content.

Do not simultaneously retain passive merit, career tier, generic XP level and chapter milestones as four mandatory progress tracks. Existing saves retain their records; inactive old records are not newly authoritative. Any change to grade-gated unlocks requires explicit migration and tests.

Remove random skill loss from ordinary inactivity in the simplified prototype. Retain skill floors, qualifications and legacy records; explicitly test old saves. If maintenance later proves enjoyable, bring it back as a disclosed, optional specialist tradeoff rather than universal annual upkeep.

Keep achievements as optional records. Existing wellbeing streak can appear in the archive; do not turn random disease or a family death into loss of a central score multiplier.

## 8. Every base action assigned once

“Merge” means one navigation/command family. It does not authorize deleting old state or conflating distinct outcomes.

| Current IDs | Destination |
|---|---|
| lookwork, presspromo, quitjob, earlyret | Job card; employment lifecycle |
| overtime, nightshift | Single Extra Shift command |
| study, practice, learntrade, leaveschool | Learning project with enrollment/exit choices |
| court, tendspouse, tendcontact, family, writemother, writefather, tendmember, meetsomeone | Connect with person/group target |
| flirt, flirtsecret, covertracks, propose, trychild, breakup, divorce, cutcontact, endaffair, estrangemother, estrangefather | Contextual relationship encounters; decisions retain different consequences |
| doctor, treatment, walk, rest, soupkitchen | Recover/care; routine free rest becomes an annual default |
| gig, crime, seekfixer, fixerjob, bottle, track, backroom2 | Opportunities/risk or contextual vice encounter; only suitable operations use stop/continue |
| expunge, usefavor, bribeBureau, bureauPermit, attendProtest | Contextual Bureau/civic encounter |
| loan, bankloan, storecredit, payoffdebt | Budget financing; migrate misleading venture loan |
| gamblelic, foundBusiness, shutDownBusiness | Real ownership lifecycle through BusinessSystem |
| relocate, leave | Map travel/holiday offer; relocation uses real movement |
| favor | Named-person request or repayment, with actual availability |
| recruit | Optional Hold membership encounter |
| namechange | Identity edit, outside routine stat farming |

Additional noncatalogue entry points:
- Desk subsidy/checkup/censure become institutional offers or event choices.
- Hold liequiet/fortify become operation preparation alternatives with their existing funds/heat consequences.
- Medical treatment pickers and family-health decisions attach to Care situations.
- School admission, funding and guardian choices attach to Learning/childhood events.
- Housing/food/childcare remain budget settings until the player changes them; do not reselect them annually.
- Petition/crisis/opportunity/story UI uses one shared visual layout while preserving each resolver and effect ownership.
- Travel and building interaction attach to destination/available opportunity cards.
- Fast-forward advances to the next consequential unresolved decision, with an explicit optional delegation policy for automatic choices.
- Succession and archives are chapter transitions, not additional action economies.

## 9. Feedback and evidence

Already implemented: sound, vibration, shakes, particles, streak cues, animated reports and illustrated stories. The missing priority is causal clarity, not the volume of effects.

Every ordinary action should update the specific result beside its target, show one short sentence and leave the next action immediately available. A successful shift shows pay and the health cost together; a broken promise shows the named person's response. A routine result does not require Acknowledge. Rare irreversible decisions use confirmation.

Research:
Kao et al. (2024), “How does Juicy Game Feedback Motivate? Testing Curiosity, Competence, and Effectance,” CHI, DOI 10.1145/3613904.3642656.
https://people.csail.mit.edu/dkao/pdf/3613904.3642656.pdf
Their preregistered action-RPG experiment (n=1,699) supports success-dependent, legible feedback; amplified feedback reduced some measured motives in that implementation. This supports testing focused results, not asserting that extra animation improves Life File.

Scheibehenne et al. (2010), choice-overload meta-analysis, DOI 10.1086/651235.
https://doi.org/10.1086/651235
The overall average effect was near zero with substantial heterogeneity. Therefore “three suggestions” is a prototype navigation decision, not a scientifically established optimal number of choices.

The prior RPG design contains the autonomy/competence and enjoyment measurement evidence. The present proposals are transfers to a text life simulation and require player validation.

## 10. Measure simplification and enjoyment separately

All numeric thresholds below are provisional engineering/product targets, not existing results or universal research cutoffs.

| Question | Measurement | Prototype target |
|---|---|---|
| Is it enjoyable? | Same post-session 1–7 enjoyment item used for baseline | Median >=5; report individual scores and baseline differences |
| Is it understandable? | Player identifies objective, remaining actions and one downside unaided | >=80% of testers |
| Do actions feel distinct? | Given Work/Learn/Connect/Recover/Risk examples, explain primary result | >=80% classify correctly; inspect confusions |
| Is routine navigation shorter? | Taps from home to complete a predefined simple action | <=2; <=3 for selecting a named target |
| Does feedback feel immediate? | Pointer activation to visible result, measured on phone and desktop | p95 <=200 ms for routine actions |
| Is presentation blocking play? | Animation-only mandatory wait per routine action | Zero; effects may finish asynchronously |
| Is a normal year manageable? | Active time for years without major story or setup decisions | Median 30–60 s, reported by device; no forced hurry |
| Is it repetitive? | Maintenance-only clicks / all committed gameplay actions | <20%, using an explicit coding rubric |
| Is stop/continue meaningful? | Choices and outcomes by offered risk, assets and remaining actions | Both options feasible; investigate dominated continuations |
| Is simplification harming agency? | “I could pursue my preferred approach,” 1–7 | Median >=5 and no clear decline from baseline |
| Can recovery fail safely? | Reachable response after illness, poverty or custody in fixtures | At least one response or explicit resolved ending |
| Does the budget stay truthful? | Displayed forecast versus actual salary/bills, excluding disclosed uncertainty | No unexplained discrepancy |

Start with 6–8 formative sessions to catch comprehension failures, using a matched adult starting state. Compare current and simplified builds with order counterbalanced; score enjoyment after a fixed opportunity to play, include early exits and reasons, and report uncertainty. Small formative samples cannot prove population improvement.

Do not equate clicks, speed, longer sessions or selection entropy with fun. A player can deliberately choose the same favorite route and enjoy it. Reduced navigation is a usability result; it must accompany maintained or improved enjoyment/agency to justify the redesign.

## 11. Implementation order

1. Fix labels and consolidate navigation first: single live action surface, one canonical ID per semantic action, truthful loan/business/travel descriptions.
2. Build adult-start prototype with three actions, five families, context-driven suggestions and clear budget receipt. Full-life mode remains accessible.
3. Consolidate instant-action, queued/autoplay and eligibility handling around shared authoritative commands; preserve salary once per year and deterministic annual ticks.
4. Create one functioning risky operation and one promise encounter. Add local measurements for input-to-feedback, taps and selected choices.
5. Remove upkeep clicks, prioritize reports, unify event presentation, make long dialogue optional expansion without changing consequences.
6. Wire one meaningful specialization; retire disconnected progress displays.
7. Run focused behavior/migration/replay tests, the full suite, world/NPC diagnostics, and phone/desktop checks before gameplay deployment.

Special migration checks: old queue IDs and aliases, rest once-year receipts, per-person targets, active travel, liability schedules, jobs/owned businesses, legal cases and custody timers, active stories and exactly-once rewards, successor person identity and archived RPG records. Do not delete or zero them to make a simplified UI work.

This audit does not change gameplay. It is the concrete implementation specification for the requested simpler direction.
