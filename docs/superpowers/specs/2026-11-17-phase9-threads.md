# Phase 9 — Cross-Domain Interlocking Life Events

Base master 09d48e98e6b29b3eff662d9522e31c96798a7dc1. Branch feat/rpg-phase9-emergent-threads-20261117.

Existing runtime has canonical StorySystem archive, dynamic contextual employer/household/civic encounters, Social NPC events, employment and NPC records, and 12 static authored quest chapters. This phase adds TWO deterministic cross-domain multi-year **transient** event chains under `StoryThreads`, implemented as generated StorySystem episodes, not 4 permanently authored catalogue entries. The authored 12-chapter auditor remains unchanged; focused integration tests cover all new event families.

**Workplace → Civic:** requires a previously filed contextual employer story and civic or Ward story from the real archive; uses the historical employer's actual business record and civic ending, never redirects a salary change to the current employer. “Public Record” → next-year “Council's Reply”, with 3 choices (bureau check, labor check, guaranteed withdrawal). Consequences use existing scrutiny, relations, learned skill and storyItem. No unbacked wages or legal cases.

**Underworld → Household:** requires a previously filed Social NPC encounter with real living NPC and a filed night market/grey manifest chapter; references exact NPC and prior outcome. “Debt at Home” → next-year “Family Testimony”, with truth, conceal and safe withdrawal. Effects are existing npcBond, RelationshipMemory and scrutiny; on death/departure, dependent options become disabled and guaranteed exit remains. An old relationship does not migrate to another person.

The definitions are transient and added only while StorySystem.startQuest builds a run. The canonical StorySystem owns all scenes, choices, archive and merit; a bounded two-key `World.storyThreadStages` stores only replay-protection high-water 0/1/2 after archival eviction. The stage is repaired on ensure, not a parallel event entity. Seeded outcomes go through canonical 3d6; no Math.random. Require completed earlier year for followup; absent/closed business and lost family links must not cause fabricated effects. Annual loop already advances `World.year`; availability is evaluated from that authoritative year, no duplicate tick.

Tests cover 2×2 stages, exact prerequisite archive and NPC references, 3d6 fail-forward and guaranteed third routes, actor death and contract switch, save/reload, archive bound, determinism, no duplicate merit, and browser layouts 320/390/768/1440; protected map paths remain unchanged.
