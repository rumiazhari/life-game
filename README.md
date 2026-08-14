# Life File

Life File is a browser-based, text-driven life simulation. You play a subject
inside a persistent, deterministic world: settlements change, NPCs age and
die, households retain their finances and relationships, and the world
continues through succession rather than resetting with a single character.

Play the current published build at
[rumiazhari.github.io/life-game](https://rumiazhari.github.io/life-game/).

## Run locally

This project has no build step or runtime dependencies. Serve the repository
as a static site, then open `http://localhost:8000/`:

```powershell
python -m http.server 8000
```

`index.html` redirects to [`life-game.html`](life-game.html), the game entry
point. Opening the HTML file directly can work, but a local HTTP server avoids
browser restrictions and stale asset caching during development.

## Current systems

The implemented simulation includes deterministic annual world progression,
persistent settlements and public health, NPC and household state,
relationship memory, reusable medical conditions and treatment, businesses,
employment contracts, employer-generated vacancies, and workplace
relationships. The game UI is a subject dossier backed by these persistent
systems; legacy UI fields are compatibility projections, not a separate world
model.

Phase status and planned work are maintained in the
[development map](docs/roadmap/README.md). The active status snapshot is
[CURRENT-STATUS.md](docs/roadmap/CURRENT-STATUS.md); verify Git history before
treating it as current.

## Verify changes

Run the full automated suite with:

```powershell
npm test
```

Focused system checks and diagnostics are also available:

```powershell
node --test tests/workplace-system.test.js
npm run diagnostic:world
npm run diagnostic:npcs
```

The simulation is plain browser JavaScript loaded directly by
[`life-game.html`](life-game.html). Persistent annual systems must preserve
schema migration, deterministic RNG streams, idempotency, invariants, and
focused tests; the repository rules are documented in
[ENGINEERING-RULES.md](docs/roadmap/ENGINEERING-RULES.md).
