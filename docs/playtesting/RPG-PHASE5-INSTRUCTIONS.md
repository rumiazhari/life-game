# Life File RPG Phase 5 — Playtest Operations

**Version:** 2026-11-17 (JST)
**Build:** Phase 5, based on Phase 4.
**Status:** Technical playthroughs are synthetic. **No human participants or real feedback reports have been collected in this task.**

## 1. Automated engineering check (no participant involvement)
From the repository root in Node.js 24:

```powershell
npm run simulate:rpg
npm run audit:rpg
npm test
```

`simulate:rpg` executes **180 actual StorySystem interactions** (12 chapters × 3 scripted policies × 5 seeds) and tests five linked follow-up quests after year advancement. It produces JSON with `provenance: automated_agent_simulation_not_human_testing`. It does not perform UI clicks or establish human enjoyment, retention, difficulty preference, completion time or comprehension.

The decision policies are **safe** (unconditional no-check route preferred), **prudent** (prefer high-probability ≥60% checks), and **bold** (prefer lowest-success-probability available check). The seeded outcomes are reproducible. Successful runs receive normal rewards from the canonical game engine, not a model of human preference.

A checked-in audit result is available at `docs/superpowers/reviews/2026-11-17-phase5-simulation.json`. This is machine-generated engineering evidence, not human research data.

## 2. Conduct human playtests
Use `docs/playtesting/RPG-PHASE4-PROTOCOL.md` with 6–8 consenting adult volunteers, each approximately 8–12 minutes. In the game's **Stories → Playtest** section, invite participants to voluntarily rate Enjoyment, Choice agency and Outcome clarity (1–5) and then use **SAVE JSON**. Do not request names, DOB, account details, personal saves, or screenshots. Participation and reporting are optional. No data is automatically transmitted.

Manually record unaided task completion, whether the player distinguishes 3d6 execution quality from racetrack 50/50 betting, and whether they correctly identify a multi-year consequence. The Playtest JSON **does not contain these observer measurements**, so keep the observer sheet separate and anonymous.

## 3. Aggregate only actual voluntarily supplied anonymous JSON
After voluntary collection, create one local JSON file containing **an array of the anonymous exports**:

```json
[
  { "schema": "life-file-playtest-v1", "form": "unvalidated_formative_3_item",
    "transfer": "user_initiated_export_only",
    "ratings": { "enjoyment": null, "agency": null, "clarity": null },
    "snapshot": { "...": "the complete exported snapshot, unchanged" } }
]
```

The excerpt above is illustrative only and not a valid standalone input: keep each **complete actual exported object**, changing no fields. Do not insert identifying metadata. Store reports locally, with appropriate consent and access control. The CLI rejects any unknown fields rather than leaking them.

```powershell
npm run aggregate:rpg -- "C:\path\to\anonymous-reports.json"
```

The output contains report count, missing responses, 1–5 distributions and medians for the three bespoke ratings, and retained-archive counts. It labels participant provenance **unverified** because an anonymous file cannot establish that entries are independent human responses. It never makes inferential claims.

## 4. Decision rules after actual observations
Compare observed task results to the **provisional** usability targets in the Phase 4 protocol. Inspect comprehension failures before changing probabilities; examine repeated early exits before reducing difficult choices. Do not retune the 3d6 target numbers or merit economy based solely on simulated-policy completion.

Do not commit or publish actual participant exports into GitHub without informed consent and an explicit retention decision. The provided test fixtures are entirely synthetic and used solely for software correctness tests.
