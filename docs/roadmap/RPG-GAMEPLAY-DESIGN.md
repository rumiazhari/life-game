# Life File: playable RPG design and evaluation plan

Date: 2026-11-15. Status: DESIGN ONLY; gameplay changes and human playtests have not been performed.
Source baseline: master f937d029f571254be388941656e88c88adc01aeb.
Target: rumiazhari/life-game (Life File), the browser life simulation, not life-after-death.

## 1. What the current game supports

Inspected README, AGENTS, engineering rules, annual pipeline, Phase 4C plan, RPG system and tests, story system/episode format, and annual/action integration in js/ui.js.
The older CURRENT-STATUS snapshot understates the current code: workplace, law, story, RPG and other systems now exist. Treat source as authoritative.

- RPG already owns merit, eight grades, three backgrounds, ten perks, six check domains, and 3d6 checks. Keep and extend this implementation.
- StorySystem owns active episodes and their archive, selects eligible episodes with a 0.5 annual spawn chance, binds existing people, and applies declarative consequences. Only one episode can be live.
- Annual actions use the existing queue/time machinery in resolvePlan(); direct actions are also tracked. Do not introduce a parallel action-point currency.
- Existing employment, household, medical, law, and relationship systems provide the material for RPG consequences.

Static inspection suggests three design risks, not measured player complaints: passive merit grants are tiny relative to grade thresholds; perk effects predominantly change modifiers; major stories depend on eligible random spawning rather than player pursuit. A subject earning only the one-point annual stipend needs 60 annual awards to reach grade II, whereas a one-tier promotion awards 120. Progress may therefore vary sharply by career and crisis exposure. Measure actual progression before changing thresholds.

## 2. Intended experience and core loop

Play a person in Karsen who builds a particular life while institutions and other people pursue their own interests. A playable RPG requires choosing an identity, acting toward a goal, solving obstacles in different ways, and recognizing lasting consequences.

Loop:
1. Read an immediate situation and select a personal objective.
2. Choose an approach using a skill, relationship, institution, resource, or accepted sacrifice.
3. Resolve against disclosed costs and risks.
4. See what changed, who noticed, and what remains possible.
5. Use a new opportunity or capability in the next situation.

Keep annual simulation for aging, income, disease, institutions and NPC life. Play several decisions inside an important encounter without advancing a year for every dialogue line. Reserve annual queue costs when committing a substantive activity, not on every dialogue click. The player's journal must say whether an action occurs now or at year end.

## 3. Systems to build

| System | Proposed behavior | Existing authority/integration |
|---|---|---|
| Personal goals | One pinned ambition, up to three active goals; player may abandon or replace them without punishment | New GoalSystem records reference people, employers and stories |
| Character development | Keep grade/merit; add perks that reveal approaches, preparation or contacts, not only higher numbers | Extend RPG and its existing subject records |
| Encounters | Offer preparation, negotiation, institutional action, or risky shortcuts when fiction permits | Extend StorySystem choice data and resolve through existing systems |
| Relationships | People remember promises, help, betrayal and incompatible loyalties; trust opens specific opportunities | NpcSystem and RelationshipMemory, not a second bond registry |
| Consequences | Immediate result plus a scheduled follow-up; changed facts remain visible in the journal | Story archive references and authoritative employment/law/household facts |
| Journal | Show objective, next feasible actions, obstacle, deadline if real, and recent causal changes | Read projections, not independent truth |
| Succession | Survivor goals close or transfer explicitly; NPC memories and world consequences persist | Integrate with the actual current succession path after auditing it |

Goals are commitments the player chooses, not a mandatory checklist. Example ambitions: secure a stable household; gain professional influence; become an independent trader; protect a named person; expose institutional misconduct. Wealth is one possible outcome, not a universal score.

Backgrounds should provide a starting connection, a problem and a distinctive approach. Preserve existing streets/scholar/veteran records and acquired perks in migration. Offer an introductory situation that demonstrates their difference before asking the player to understand a large character sheet.

Do not make every route a dice roll. A valid qualification or accepted fixed cost can guarantee access. A relationship can grant an introduction without guaranteeing cooperation. Tests resolve uncertainty only when failure changes the situation.

## 4. First playable slice: The Thursday Ledger

Expand the existing workplace episode rather than starting a disconnected quest catalogue. Prototype entry: adult player with a real employment contract at a struggling business; bind a real coworker. Provide a separate start fixture for testing so players need not wait for random eligibility.

Objective: respond to threatened wages while deciding whose interests to protect.

| Approach | Preparation and opportunity cost | Consequence and follow-up |
|---|---|---|
| Document the discrepancy | Study/labor competence; spend existing planning time collecting records | Evidence enables a formal challenge; supervisor learns who compiled it |
| Negotiate through a coworker | Existing trusted coworker; promise a reciprocal favor | Possible partial payment; later choice to honor the promise |
| Petition through the Bureau | Evidence plus an available institutional route | Legal exposure for the employer; coworker may fear closure |
| Take an illicit shortcut | Crime/hustle approach with explicitly stated exposure | Immediate relief can create leverage for a fixer |
| Accept or leave | No random test required; disclose household tradeoff | Preserve a relationship or lose income; job search becomes an explicit next step |

These are proposed routes, not claims about current episode branches. Before implementation inspect the episode's existing endings and map additions onto them.

Structure: discover discrepancy -> prepare or seek help -> choose confrontation -> resolution -> next-year callback. Every route has an immediate ending; at least two substantially different settlements of the conflict are possible. Failure can create debt, a new obligation, alternative evidence or an appeal, rather than requiring the same click again. Do not award invented unpaid wages through an extra payroll path: any wage-recovery mechanic needs a separately identified arrears transaction.

Slice scope: one expanded episode, three demonstrably distinct approaches, two named recurring people where available, one nonnumeric perk use, one delayed callback, and a journal connecting decisions to outcomes. Broader ambitions and more content follow only after this loop is understood and enjoyed.

## 5. Checks and progression

Keep the current roll: total = 3d6 + clamped modifier; success when total >= target.
At zero modifier, current easy/standard/hard/severe targets 7/9/11/13 have exact success probabilities 196/216, 160/216, 108/216, and 56/216 (90.7%, 74.1%, 50.0%, 25.9%).
These are mathematical probabilities, not desired fun levels.

Preview odds from all 216 equally likely outcomes, using exactly the resolver's final modifier clamp. Show cost, skill contributions, material downside and whether an outcome is guaranteed. Distinguish uncertain NPC intentions from a numerical roll probability. Never silently alter a roll after commitment to produce a preferred success rate.

Prototype outcome bands: margin >= 3 clean success; 0..2 success with a disclosed complication; -1..-2 setback with a new route; <= -3 serious setback. This changes current binary behavior and requires explicit content support and tests. Do not apply it globally until authored outcomes exist.

Reward resolving a meaningful goal, discovering a usable approach and honoring a costly commitment. Grant comparable merit for different legitimate solutions, including principled refusal. Do not grant merit per dialogue click or repeatable trivial action. Award once per resolution ID, independent of a bounded display history; the current year/reason deduplication is not a sufficient permanent quest-reward ledger. Measure years and meaningful decisions to the first chosen perk, split by background/route, before calibrating rewards. Aim initially for a first consequential development choice within the first completed slice, not after decades of passive aging.

## 6. What research supports

[R1] Ryan, Rigby & Przybylski (2006), The Motivational Pull of Video Games, DOI: 10.1007/s11031-006-9051-8.
https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf
Four studies associate perceived competence and autonomy with enjoyment; multiplayer results also support relatedness. Application here: meaningful routes, understandable consequences and recurring people are design hypotheses. Evidence about social relatedness does not prove that a particular fictional NPC will be compelling.

[R2] Vanden Abeele et al. (2020), Development and validation of the Player Experience Inventory, DOI: 10.1016/j.ijhcs.2019.102370.
https://doi.org/10.1016/j.ijhcs.2019.102370
Scale development involved 64 game experts and validation studies totaling 529 participants. PXI distinguishes functional experience from psychosocial experience. Use the published instrument/scoring intact if adopted; a locally written questionnaire must not be labeled validated PXI. Publisher abstract was available; full text was not retrieved.

[R3] Cutting et al. (2023), Difficulty-skill balance does not affect engagement and enjoyment, DOI: 10.1098/rsos.220274.
https://pmc.ncbi.nlm.nih.gov/articles/PMC9890114/
A preregistered tactical-game experiment with 311 participants found no significant enjoyment/engagement effect of the manipulated ratios. This limits universal claims that a fixed success rate produces flow. Transfer to this text RPG is uncertain; measure challenge enjoyment directly.

[R4] Johnson, Gardner & Perry (2018), Validation of two game experience scales: PENS and GEQ, DOI: 10.1016/j.ijhcs.2018.05.003.
https://doi.org/10.1016/j.ijhcs.2018.05.003
This validation work is a reason to check instrument properties rather than assuming every familiar game questionnaire is interchangeable. Only abstract/search-accessible material was reviewed here.

## 7. Operational definition of fun

Primary outcome: the player's reported enjoyment after a fixed opportunity to play. Behavioral records diagnose mechanisms; they cannot independently prove enjoyment. No weighted master “fun score” is proposed.

The following are provisional product acceptance targets chosen for this prototype, NOT published scientific cutoffs or measured results. Custom questions use 1 = strongly disagree to 7 = strongly agree.

| Measure | Definition and collection | Initial prototype target |
|---|---|---|
| Enjoyment, primary | “I enjoyed this play session”; answer after 20 minutes or earlier exit | Median >= 5/7; inspect full distribution |
| Agency | “I could pursue an approach that suited my character” | Median >= 5/7 |
| Mastery/clarity | “I understood how my choices changed my chances and outcomes” | Median >= 5/7 |
| NPC investment | “What happened to at least one person mattered to me” | Median >= 5/7 |
| Frustration | “The game obstructed me without giving me a useful response” | Median <= 3/7 |
| Onboarding | Seconds from interactive start until first committed choice with a real cost or consequence | Median <= 180 seconds |
| Goal comprehension | Unaided player identifies current objective and one feasible next action | >= 80% of testers |
| Consequence comprehension | Player correctly explains one actual persistent effect of their decision | >= 80% |
| Route viability | Playtest completions and failure recovery, separately by approach | Every advertised route completable in deterministic fixtures |
| Recoverable failure | Setbacks with at least one feasible, visible next action / all observed nonterminal setbacks | 100% in slice fixtures; investigate any human dead end |
| Optional continuation | Accepts a clearly optional additional five minutes after the fixed session | Report proportion; no initial cutoff |
| Repetition | Repeated outcome text within the slice and reasons for repeated actions | Zero accidental duplicate resolutions/rewards |

Do not treat equal route popularity as success: preference and role identity can legitimately favor a route. Look for a universally superior route with no meaningful cost. Likewise, early stopping can mean satisfaction with a completed story, boredom, confusion or a technical problem; ask the reason.

## 8. Playtest and comparison protocol

First run 6–8 formative sessions with players comfortable with text/life RPGs, covering keyboard and phone use. Observe onboarding without coaching; collect the custom questions and short explanations. This sample discovers problems and does not establish population-level improvement.

Record a baseline from the current published version before evaluating the redesigned slice. For a controlled pilot, randomly assign or counterbalance baseline/revised order, use matched starting states and scenarios, fixed 20-minute sessions, and record prior genre experience and device. Reusing identical narrative material creates learning effects; disclose and mitigate with parallel scenarios.

Report per-player scores, sample size, early exits, technical failures and missing responses. For a crossover pilot report paired enjoyment differences with uncertainty, alongside order effects; do not call a small descriptive improvement statistically established. Choose any larger confirmatory sample using pilot variance and a prespecified smallest worthwhile difference, rather than inventing a universal required sample.

Ship the broader design only after formative blockers are fixed and enjoyment, agency and clarity are acceptable together. Increased clicking or session duration with flat enjoyment is not sufficient evidence of success.

## 9. Implementation architecture and safety

Proposed additions, not existing APIs:
- js/systems/goal-system.js: bounded goals keyed to stable actor IDs; definitions separate from runs.
- js/ui/rpg-journal-ui.js: journal projection; uses existing state and events.
- Extend js/systems/rpg-system.js and story-system.js: approach previews, checks, choice requirements, result bands, durable resolution receipt references.
- js/data/rpg-goals.js: small authored goal catalogue, loaded explicitly in life-game.html.
- Optional local playtest event recorder outside gameplay RNG and outside authoritative state.

A goal run needs id, definitionId, actorId, status, startedYear, stepId, bound entity references, resolutionId, resolvedYear, and bounded history. Proposed bounds: three active goals per actor, 64 recent resolved records and 24 history entries each. Durable anti-duplication receipts must survive display-history pruning, using a bounded content-defined completion set for this slice. A repeated action or reload must not pay twice. Avoid resurrecting missing/dead NPCs to repair a quest; transition to an authored unavailable/alternate state.

Do not refactor the annual pipeline wholesale. Immediate story choices call authoritative mutation APIs; year-end goal evaluation reads the settled results after existing actions/story/mortality, without replaying them. A player-committed encounter cannot be silently autoplayed by fast-forward: pause for it, or require an explicit delegation policy. Existing StorySystem autoResolve behavior needs this integration change.

Record playtest events locally with explicit export: session/build/scenario, event sequence, elapsed active time, goal/choice/approach IDs, displayed odds, result, and consequence IDs. No dialogue text or personal data is needed. Pause active-time accounting when hidden; preserve raw elapsed time separately. Exclude automated/fast-forward events from human decision-time metrics. Record no remote analytics by default.

## 10. Delivery sequence and verification gates

1. Baseline: instrument the slice and capture human baseline; fix misleading current-status references for this work without rewriting unrelated phase history.
2. Goals and journal: schema/migration/API/invariants and deterministic tests, then UI. Exit: choose, inspect, abandon and resume a goal without corrupting saves or duplicating rewards.
3. Encounters: extend the existing workplace story, explicit approach requirements, exact odds preview, and authored setbacks. Exit: every route and death/closure interruption covered by fixtures.
4. Progression: one background-sensitive approach and one meaningful perk unlock; calibrate against decisions and simulated years.
5. Consequences: next-year callback, persistent NPC memory and successor handling.
6. Evaluation: fixed-session playtests; iterate from comprehension failures and enjoyment reports.
7. Release: npm test, world/NPC diagnostics, relevant migration/replay/double-payment tests, and phone/desktop UI checks. Existing pages.yml already gates GitHub Pages deployment on tests and diagnostics for master pushes.

This document adds a design, not an implemented RPG improvement. No baseline fun scores, playtest results or runtime verification are claimed.
