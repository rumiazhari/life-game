# Android-responsive UI (2026-11-16)

The original Life File had horizontal clipping despite documentElement.scrollWidth matching the viewport. The dossier tabs were a horizontally overflowed rail, while a later desktop .wb-main rule overrode the original mobile media query, shrinking vital statistics to unreadable columns on 320px screens. The sticky decision footer also used negative inline margins, making sheets 4–6px wider than the viewport.

## Implementation

- css/mobile-adaptive.css loads AFTER style.css and story-rpg.css, fixing the CSS cascade.
- At 720px and below, the dossier navigation uses a two-row four-column grid with original DOM IDs and handlers.
- The dossier metadata wraps naturally, and Section D reacts to its own container width at 640px, 360px and below.
- Section C collapses household/finance/city cards; long names and records wrap without expanding grid tracks.
- The main action bar adapts at 540px and below; safe-area padding remains, and open modals hide overlapping status chrome.
- Decision sheets remain scrollable vertically. The sticky footer no longer has negative inline margins.
- Country and 2.5D city maps retain minimum usable viewport height and scroll their long city intelligence sections.
- Portrait, landscape and tablet widths are handled by separate CSS media and container queries.
- Controls have 42–44px tap-target minimums where applicable.

## Validation

Headless Chrome 157 on AEROMI emulated Android screen widths 320, 360, 390, 412, 480, 600, 768, 920, and 1024px at deviceScaleFactor=2. Dossier, Priorities, Decisions, Story, Country Map, City Map and cover were measured. At widths 320–600px, every open modal panel had scrollWidth equal to clientWidth after the fixes. The map information section scrolled vertically when longer than the available height. Native Samsung keyboard and accessibility font scaling have not been verified on physical hardware.

Source regression test: node --test tests/mobile-adaptive-ui.test.js.
