# Roadmap Maintenance

How to keep this roadmap accurate as work lands. The roadmap is only useful
if it is trusted; an update that skips verification is worse than no
update.

## After a phase implementation is pushed to a development branch

1. Update the branch name and commit SHA in
   [CURRENT-STATUS.md](CURRENT-STATUS.md)'s status table and header.
2. Mark the affected slice(s) **IMPLEMENTED ON BRANCH**, not MERGED.
3. List any open review blockers found during the review steps in
   [AI-Handoff-Protocol](AI-HANDOFF-PROTOCOL.md) directly in the relevant
   phase page's status line, so the next session knows what still needs
   fixing before merge.
4. Do **not** mark the work MERGED — that status is reserved for
   `origin/master`.

## After a PR is merged

1. `git fetch origin` and confirm the merge commit on `origin/master`.
2. Record the merge commit SHA in [CURRENT-STATUS.md](CURRENT-STATUS.md)'s
   header and status table.
3. Mark the completed slice(s) **MERGED** (only the slices actually in the
   merge — a PR that merges 4C-1 through 4C-3 does not make 4C-4 MERGED).
4. Update the "Immediate next action" section of
   [CURRENT-STATUS.md](CURRENT-STATUS.md).
5. Update the "Current state" summary in
   [docs/roadmap/README.md](README.md) and the root
   [ROADMAP.md](../../ROADMAP.md).
6. Update the relevant phase page(s) — move completed slices' descriptions
   from "planned" language to confirmed, source-verified language (see
   [Documentation Quality](README.md) expectations — never describe a
   planned API as existing without re-reading the merged source first).
7. Update the wiki mirror (see below) to match.
8. Commit the documentation update **separately** from any code change —
   documentation commits should never be bundled into a feature commit.

## When architecture changes

- Update [REPOSITORY-ARCHITECTURE.md](REPOSITORY-ARCHITECTURE.md) whenever
  a file is added, removed, renamed, or its responsibility changes.
- Update [ANNUAL-SIMULATION-PIPELINE.md](ANNUAL-SIMULATION-PIPELINE.md)'s
  "Current actual order" section whenever `advanceYear()` (or its
  eventual registered-phase replacement) changes order.
- Update [ENGINEERING-RULES.md](ENGINEERING-RULES.md) **only** when a rule
  itself changes (a new mandatory pattern, a relaxed constraint) — not
  every time a system merely follows the existing rules. Rule changes
  should be rare and deliberate.

## When plans change

Plans evolve — a phase may get reordered, split, or partially redesigned.
When that happens:

- **Preserve prior completed history.** Never rewrite or delete the record
  of what was actually built and merged, even if the plan around it
  changed later.
- **Add a short decision note** at the point of change (e.g. a dated
  paragraph in the affected phase page: "as of \<date\>, slice X was
  deferred until after Y because ...") rather than silently editing the
  plan as if it had always read that way.
- **Explain dependencies and replacement scope** — if a new plan replaces
  part of an old one, say explicitly what it replaces and why, so a future
  reader is not confused about which description is current.
- **Do not silently rewrite completed-phase history.** A page describing a
  MERGED phase should only change to correct a factual error (verified
  against source) or to update dependent-phase links — not to reinterpret
  what already shipped.

## Wiki sync

The [GitHub Wiki](https://github.com/rumiazhari/life-game/wiki) mirrors
`docs/roadmap/` for browsing without a clone. After any `docs/roadmap/`
update that should be visible there:

1. Clone or fast-forward the sibling wiki checkout
   (`life-game.wiki.git`, cloned outside this repository — see
   [AI-Handoff-Protocol](AI-HANDOFF-PROTOCOL.md) for why it must not live
   inside the main repo).
2. Update the corresponding wiki page(s) using the main-repo-to-wiki page
   mapping below.
3. Update `_Footer.md`'s "Last verified commit" line.
4. Commit with a clear message and push the wiki's default branch.

| Main repository file | Wiki page |
|---|---|
| `docs/roadmap/README.md` | `Home.md` (wiki-style links, not relative file links) |
| `docs/roadmap/CURRENT-STATUS.md` | `Current-Status.md` |
| `docs/roadmap/REPOSITORY-ARCHITECTURE.md` | `Repository-Architecture.md` |
| `docs/roadmap/ENGINEERING-RULES.md` | `Engineering-Rules.md` |
| `docs/roadmap/ANNUAL-SIMULATION-PIPELINE.md` | `Annual-Simulation-Pipeline.md` |
| `docs/roadmap/COMPLETED-FOUNDATION.md` | `Completed-Foundation.md` |
| `docs/roadmap/PHASE-4C-BUSINESSES-AND-EMPLOYMENT.md` | `Phase-4C-Businesses-and-Employment.md` |
| `docs/roadmap/PHASE-5-GOVERNMENT-LAW-AND-POLITICS.md` | `Phase-5-Government-Law-and-Politics.md` |
| `docs/roadmap/PHASE-6-ADVANCED-HEALTH-AND-REPRODUCTION.md` | `Phase-6-Advanced-Health-and-Reproduction.md` |
| `docs/roadmap/PHASE-7-NARRATIVE-EVENT-CHAINS.md` | `Phase-7-Narrative-Event-Chains.md` |
| `docs/roadmap/PHASE-8-PROPERTY-HOUSING-AND-CREDIT.md` | `Phase-8-Property-Housing-and-Credit.md` |
| `docs/roadmap/PHASE-9-INHERITANCE-AND-DYNASTY.md` | `Phase-9-Inheritance-and-Dynasty.md` |
| `docs/roadmap/PHASE-10-NATIONAL-HISTORY.md` | `Phase-10-National-History.md` |
| `docs/roadmap/PHASE-11-CONTENT-PERFORMANCE-AND-PRESENTATION.md` | `Phase-11-Content-Performance-and-Presentation.md` |
| `docs/roadmap/PHASE-12-SAVES-AND-RELEASE.md` | `Phase-12-Saves-and-Release.md` |
| `docs/roadmap/AI-HANDOFF-PROTOCOL.md` | `AI-Handoff-Protocol.md` |
| `docs/roadmap/ROADMAP-MAINTENANCE.md` | `Roadmap-Maintenance.md` |

`_Sidebar.md` and `_Footer.md` have no main-repository equivalent — they are
wiki-navigation-only and maintained directly in the wiki checkout.
