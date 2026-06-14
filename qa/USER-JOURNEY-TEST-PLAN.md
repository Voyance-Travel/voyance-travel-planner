# Voyance — User-Journey QA Test Plan

> **Why this exists.** We have strong *technical* coverage (unit tests, headless
> edge-function checks) but we have NOT been testing the product the way a real
> user experiences it: arriving with a goal, going through the actual flow, and
> looking at the *rendered* result. Bugs keep slipping past "fixed" because the
> verification stopped at the function boundary (e.g. the Atlanta hero — seeded
> a DB row, never confirmed it rendered; the day trip — passed unit tests, but a
> real same-day trip still shipped hotel cards + a thin day).
>
> This plan tests **intent → trip shape → generation quality → rendering →
> editing** for each way a real user approaches the site. The unit/headless
> tests are the *safety net*; THIS is the *acceptance test*.

## How to run it (methodology)

**Test through the real site as the persona — not the edge functions.** A user
never calls `generate-itinerary`; they type into chat, click buttons, and look
at a page. The integration + rendering layer is exactly where we've been blind.

Two engines, used together:
1. **Live UI drive (primary, most faithful):** log in as the persona on the
   production site and walk the flow. Record what actually renders. This is the
   only thing that catches images, layout, phantom cards, dead-ends, latency.
2. **Headless pipeline harness (fast triage):** drive chat-trip-planner +
   generate-itinerary directly (see `qa/harness/`), inspect the produced trip.
   Catches intent→output mismatches in seconds, but NOT rendering. Use it to
   pre-screen, then confirm the winners/losers in the UI.

For each test, mark every **stage** Pass / Fail / Partial and capture a note or
screenshot. A flow only "passes" if every stage passes — a great itinerary that
renders with a broken hero is still a Fail.

### The 5 stages every flow is graded on
| Stage | Question | Common failure we've hit |
|---|---|---|
| **A. Intent capture** | Did it ask the right questions / capture concrete-vs-vibe / handle a vague destination? | World Cup as a literal must-do; vague "walk around" → "free downtown activities"; no discovery for "Spain" |
| **B. Trip shape** | dates→nights, day-trip vs overnight, single vs multi-city, flights/hotels only when relevant? | day trip still showed flights/hotels |
| **C. Generation quality** | real named venues, theme match, no filler, no dupes, geo-coherent, right meals, no phantom hotel/checkout? | thin meals-only day; phantom "Checkout from Your Hotel"; cross-city venue bleed |
| **D. Rendering** | page loads, hero image shows quickly, day cards readable, flight/hotel UI appropriate, edit tools present, no console errors? | Atlanta hero blank/slow; flight/hotel CTAs on a day trip |
| **E. Edit / iterate** | regenerate, swap, move, add activity, add flight/hotel — all work and persist? | regenerate needed to pick up fixes; persist-drift on ready trips |

---

## Personas & flows

> Run these against the **deployed** build. Note the current branch is
> `fix/v2-geo-routing-parity`; confirm each fix is deployed before grading.

### P1 — The day-tripper (local, 0-night)
**User goal:** "I'm in Atlanta for the World Cup, I just want a fun day walking around."
- **Input (chat):** "1 day in Atlanta on Aug 15 2026, 2 of us, here for the World Cup, just want to walk around and see the sights. No flights or hotel."
- **Expected A:** captures Atlanta, 1 day, 2 travelers; World Cup + "walk around" → vibe/notes, NOT must-do cards.
- **Expected B:** 0 nights → **no flight, no hotel** anywhere (UI sections AND generated cards).
- **Expected C:** a FULL day of **real Atlanta venues** (Centennial Olympic Park, World of Coca-Cola, Georgia Aquarium, MLK sites, Ponce City Market, BeltLine), 3 meals, sensible flow; **no** "Checkout/Check-in/Return to Your Hotel", **no** "free downtown activities" filler, **no** literal "World Cup" card.
- **Expected D:** Atlanta hero image loads fast; day reads as a real day out; no flight/hotel prompts.
- **Expected E:** can swap a venue / add one.

### P2 — The occasion traveler (themed, multi-day)
**User goal:** "Planning a birthday trip to Madrid for my partner."
- **Input:** "4-day birthday trip to Madrid, 2 people, June 2026. Want something special and romantic."
- **Expected A:** captures Madrid, 4 days, 2; birthday/romantic → theme/vibe (rooftop dinners, special venues), not a literal "birthday" card.
- **Expected B:** multi-day → flights + hotel prompts ARE appropriate and present.
- **Expected C:** real Madrid venues themed to the occasion (Retiro, Prado, a special dinner, rooftop), geo-coherent days, no filler.
- **Expected D:** Madrid hero loads; per-day flow; flight/hotel sections present and usable.
- **Expected E:** add a real hotel via Find-My-Hotel; itinerary re-times around a flight.

### P3 — The open explorer (no city → discovery)
**User goal:** "I want to go to Spain but don't know where."
- **Input:** "A trip to Spain in May, 7 days, 2 people. Not sure which cities."
- **Expected A:** **Discovery mode** — it should NOT silently pick a city; it proposes candidates (Barcelona / Madrid / Seville / San Sebastián…) and asks the user to choose or narrow. Picking for them is a trust break.
- **Expected B–E:** only after the user picks, proceeds like P2/P4.

### P4 — The specific planner (single city + hard requirements)
**User goal:** "I know exactly what I want."
- **Input:** "5 days in Tokyo, Oct 2026, 2 people. Must do teamLab Planets and a sushi omakase. Staying in Shibuya. Slow pace."
- **Expected A:** captures concrete must-dos (teamLab Planets, omakase), neighborhood (Shibuya), pace (slow) — as real constraints, not vague.
- **Expected C:** teamLab + an omakase actually appear and are scheduled; Shibuya-anchored; slower days (fewer activities); no cross-city venues (Kyoto things on a Tokyo day).
- **Expected E:** the must-dos are locked / survive a regenerate.

### P5 — The multi-city traveler (ground transport)
**User goal:** "Lisbon and Porto, by train."
- **Input:** "Lisbon and Porto, 6 days total, 2 people, July 2026. Taking the train between them."
- **Expected A:** two cities + nights split; **train** chosen for the inter-city leg.
- **Expected B/C:** inter-city day shows a **train** journey (not a flight, no airport transfer); each city's days use that city's real venues; no Porto venue on a Lisbon day.
- **Expected D:** the flight form does NOT pre-fill the Lisbon→Porto leg as a flight; arrival prompt says "Add your train details," not "Add Your Flight."

### P6 — The wizard / "build it myself" user (form, not chat)
**User goal:** the structured path — pick destination, dates, travelers, preferences via the form.
- **Walk the wizard** end to end for a single city (e.g. Barcelona, 4 days). Confirm each step collects what it should, the quiz/DNA feeds preferences, and the generated trip reflects them (a foodie gets food-forward days, etc.).
- **Also run the day-trip case through the wizard** (Barcelona, same start/end) to confirm B/C/D match P1 — the suppression must hold on BOTH entry paths, not just chat.

---

## Cross-cutting checks (run on every generated trip)

- **Images:** hero loads within ~2s and is the RIGHT city (not a gradient, not a wrong-city photo, not perpetually blank). Activity thumbnails where expected.
- **No phantom logistics:** no "Checkout/Check-in/Return to Your Hotel" unless there's a real hotel; no airport/flight cards unless there's a real flight.
- **No filler / placeholders:** no "Free downtown activities", "Things to do", "Activity", unnamed venues.
- **Geo + time sanity:** days don't zig-zag across the city; nothing after a hotel-return/checkout; meals at sane times; departure day has no late activities.
- **Performance / dead-ends:** generation completes (no infinite spinner); page has no console errors; back/refresh doesn't lose the trip; partial trips recover.
- **Mobile:** spot-check the itinerary + creation flow on a narrow viewport.

---

## Scorecard (fill per run)

| Persona | A intent | B shape | C quality | D render | E edit | Overall |
|---|---|---|---|---|---|---|
| P1 day trip (Atlanta) | | | | | | |
| P2 occasion (Madrid) | | | | | | |
| P3 discovery (Spain) | | | | | | |
| P4 specific (Tokyo) | | | | | | |
| P5 multi-city (Lisbon/Porto) | | | | | | |
| P6 wizard (Barcelona) | | | | | | |

**Exit criteria for "ship-ready":** every persona Pass on A–D, and at least the
core edit (E) on P1/P2. Any Fail → file it with the persona + stage so the fix
is scoped to the real user impact, not just a unit.
