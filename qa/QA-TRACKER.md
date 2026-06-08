# Voyance Travel — QA Master Tracker

**State + checklist.** Every page/feature/concern gets two checks — a code **Audit** and a **Live** test — and is DONE only when **both are ✅** on the **new stack** (code-read alone ≠ done). When something fails: record what went wrong → the resolution → verify the fix before closing.

**Env:** owned Supabase `qpwexpjqzsdkjkvgcntx` · OpenRouter AI · Vercel (`voyance-travel-planner.vercel.app`) = staging. `travelwithvoyance.com` stays on old Lovable (rollback) until cutover is QA-verified. Test credits authorized · Account: ashtonlaurenn@gmail.com.

---

## CURRENT STATE — 2026-06-07

| Track | State |
|---|---|
| 🚚 Migration & cutover | ✅ **DONE** — own Supabase + OpenRouter + Vercel; 48,831 content rows; schema/functions/secrets/realtime/Stripe/email live |
| 🤖 Core trip generation | ✅ **WORKING — verified live e2e** (free first trip: 4 days / 63 real DNA-differentiated activities) |
| 🔓 Paid unlock (bulk + full-trip) | ✅ **WORKING — verified live** (−120 cr, days unlock, ledger correct) |
| 💬 Freemium copy | ✅ accurate ("first trip starts free — 2 days included") |
| ✏️ In-itinerary edit persistence | ✅✅ **FIXED + VERIFIED 2026-06-07** — save-itinerary was crashing on EVERY real trip (`ReferenceError: day`) so reorder/autosave/AI-notes/lock-toggle silently never persisted. Root crash fixed; edits now save + read back from DB. Resolves the whole C-PERSIST cluster. |
| 💵 In-itinerary cost display | ✅✅ **FIXED + VERIFIED 2026-06-07** — cost-doubling (×travelers every sync) traced to a DB trigger writing the GROUP total into the per-person `amount`; trigger now writes per-person. Madrid day-1 $8,395→$185/pp, stable. Test-trip data repaired. |
| 🧭 Build modes (all 4 + free) | ✅✅ **ALL VERIFIED LIVE 2026-06-07** — Single City (paid Barcelona −210), Multi-City (Lisbon→Porto, 5d/2 cities/transition), Just Tell Us (chat→Rome 3d), Build Myself = Free version (paste-organize, 0 charge). Cost display == charge in every mode. |
| 💳 Paid-gen unlocks its days (C-PRICE-1) | ✅✅ **FIXED + VERIFIED 2026-06-07** — was charging to generate AND again to unlock (~660 for a 5-day). Now one charge unlocks all days (fresh Rome gen → `unlocked_day_count=3` auto). |
| 🧬 DNA → itinerary differentiation (B3, "the big proof") | ✅✅ **PASSED LIVE 2026-06-07** — same Rome/dates/inputs, only DNA archetype differs → culinary vs adventure = **~92% venue divergence**, ~0% non-meal-activity overlap; archetype drives SELECTION (C-DNA-4 verified). |
| 🍽️ Preference adherence (dietary) | ✅✅ **FIXED + VERIFIED LIVE 2026-06-07 (`f6678c3ef`, deployed)** — strictly-vegan trip in **meat-heavy Bologna** → ALL dining venues explicitly vegan (Pappare', Botanica Lab plant-based Bolognese, Caminetto d'Oro vegan tasting menu, Forno Brisa vegan breakfast); one slot left a graceful "no vetted vegan venue, ask concierge" gap rather than serving meat = hard-veto working. Before fix: "butter chicken" + "cured meats" slipped in. Capture verified (`dietary_restrictions=["vegan"]` in DB) → enforce. |
| ✏️ Swap replacement persistence (C-TOOL-8) | ✅✅ **FIXED + VERIFIED 2026-06-07** — swap silently lost the new venue on reload; now persists immediately (Medici Chapels swap verified). Plus broader hardening: ALL day-mutating editor handlers now immediate-persist (no autosave-only). |
| 🔵 Product QA on new stack | **~68%** — ✅ green: core build/money path, **all 4 build modes**, **generation correctness**, **build-wizard steps** (D2), **DNA→output differentiation + dietary HARD-filter** (B3/C-PREF-1), **Table A pages** (A1-A9 mostly green; A8 admin red CLEARED via SQL — C-CRED-9/C-DATA-1/C-COST-3 all resolved on clean new stack), **Table B credits/cost** (B2 tools, B4 cost-validation/refund/monthly-grant/no-leak verified, B5 per-trip actuals $2.91 confirm audit), **in-itinerary tools** (reorder/swap/add/AI-Apply/regen/day-unlock/restaurant-recs all persist + charge right). **STILL UNTESTED LIVE:** prefs pace/budget/accessibility→output (need gens), D5 tools smart-finish/route-opt/hotel-opt/notes/export/maps, deeper nav (Friends-flow/footer), A4 free-text DNA path, auth-flow tails (signup/reset/logout), A1 logged-out marketing (needs incognito = owner). |

**Now working through (owner-directed 2026-06-07 PM):** (1) ✅ tracker headline reflects build-mode + DNA wins; (2) ✅ preferences→output (D3) tested; (3) ✅ per-tool charges tested; (4) ✅✅ **C-TOOL-8 swap-persist FIXED+VERIFIED** + ALL edit handlers hardened (`9239a1901`); (5) ✅✅ **C-PREF-1 dietary HARD-filter FIXED + DEPLOYED + VERIFIED** (`f6678c3ef`) — vegan Bologna = 100% vegan dining (hard-veto confirmed in a meat-heavy city); (6) ✅ nav dead-ends spot-checked (no dead ends); (7) DNA-accuracy: live DNA card shows calibrated "71% match + secondary archetype"; (8) ✅ **C-CHAT-1 (AI-Assistant Apply) closed** — NOT a universal bug; works on clean trips (Bologna Apply ✅), failed only on a heavily-degraded test trip. **Edge-deploy now unblocked (owner set SUPABASE_ACCESS_TOKEN).** Remaining: pace/budget prefs, a few D5 tools, deeper nav, auth tails.

### Defect sweep — 2026-06-07 PM (parallel-agent scoped + verified)
**Closed this sweep:**
- ✅ **C-TOOL-1/2/3/4** (refund-on-failure for day-unlock / AI-chat modifier / route-opt / add-activity) — **already correctly wired** in current tree (inline `C-TOOL-N` remediation comments + verified refund paths). No change needed.
- ✅ **C-TOOL-5** (price copy drift) — fixed: pace/filter chat actions advertised 5cr but are free (→0); rewrite badge 10→30; chat prompt "10 credits"→"30". Display/copy only. Deployed.
- ✅ **C-PERSIST-3** (lock toggle reverts on frozen trips) — root-caused: JSON sync was frozen-blocked (no saveReason); added `saveReason:'lock-toggle'` ×3 in action-toggle-lock.ts. Deployed. **⚠️ Update 2026-06-07: the bigger blocker was a save-itinerary crash (see below) — that's now fixed, so all editorial saves (incl. lock) actually persist.** *(Lock re-toggle live-test still pending.)*
- ✅ **C-CREATE-1** ("Just Tell Us" zero-day trip) — added `isBefore(end,start)` guard in Start.tsx. Deployed.
- ✅ **C-DATA-1** (IAP user_tiers) — **confirmed applied in prod**: `fulfill_credit_purchase` upserts user_tiers (covers both Stripe + IAP paths). Closed.
- ✅ **C-SEC-1** (verify_jwt=false default) — assessed: posture acceptable (truly-public fns verify signatures; data fns self-verify via require-auth). Do NOT flip globally. No change.

**🔬 DUG IN → ✅✅ ALL RESOLVED — reorder/persistence/cost-recompute (Madrid live test, owner-requested):** drove real reorders (⋯ → Move down). **Three REAL bugs surfaced and all are now fixed + verified live** — correcting an earlier wrong "not a bug" call:
- **✅ FIXED — cost DOUBLES on every reorder (`resolvePerPersonForDb`, commit `fb35090b0`).** A real reorder inflated Madrid day-1 **590→1150** (= ×num_travelers=2). Root cause = `[CPP_DOUBLE_COUNT]` feedback loop: the `activity_costs` sync writes `act.cost` back as `{basis:'ledger', amount:GROUP_TOTAL(160), perPerson:80}`; on the next sync `resolvePerPersonForDb` read **`amount`** (the group total) and, because `'ledger'` ≠ flat/per_room, returned it **without ÷travelers** → cpp re-multiplied by travelers every sync (breakfast 10→20→40→80…). **Fix:** prefer `cost.perPerson` when present + treat `'ledger'` like flat. **⚠️ SUPERSEDED — this was only a partial (defense-in-depth) fix; the TRUE root cause was a DB trigger writing the group total into `act.cost.amount` → see the ✅✅ trigger fix below (migration `20260607230000`).**
- **✅✅ FIXED + VERIFIED — CRITICAL: save-itinerary crashed on EVERY real trip → no in-itinerary edits persisted (commits `6a481b4c0`, `135208067`).** Root cause: a stray `}` in `action-save-itinerary.ts` closed the per-day meal-guard loop one block early, so the per-day dedup (`collapseRedundantInjectedMeals(day.activities)` + `dayNumber` log) ran OUTSIDE the loop → **`ReferenceError: day is not defined` at runtime** → the handler crashed (HTTP 500, no CORS) → the browser surfaced **`FunctionsFetchError: Failed to send a request to the Edge Function`**. **Impact:** every `save-itinerary` call on a real multi-day trip crashed, silently breaking ALL in-itinerary edit persistence — **reorder, editor autosave, AI-notes, lock-toggle**. (Tiny payloads survived because the day-count guard short-circuited first; cost still changed because `syncBudgetFromDays` writes `activity_costs` via a direct REST call.) **Found via:** instrumented the invoke → reproduced `Failed to fetch` at 854ms → edge logs showed `ReferenceError: day is not defined at action-save-itinerary.ts:1060`. **Fix:** moved the dedup back inside the loop. Also fixed 2 sibling latent ReferenceErrors found by deno-check in non-default save branches: `callerMetaSuccess` (persist-itinerary.ts:453, timing-audit branch) and `parsedFineTune` (action-save-itinerary.ts:1331, fine-tune merge branch). **VERIFIED LIVE:** Madrid full save → **200** (was "Failed to fetch"); a title edit saved + **read back from the DB (`persisted:true`)**. In-itinerary edit persistence now works. *(Cleanup TODO: remove the `[SAVE_PROBE]` debug instrumentation added to EditorialItinerary.tsx — harmless, only logs on save error.)*
  - **✅✅ FIXED + VERIFIED — cost-doubling ROOT CAUSE was a DB trigger (migration `20260607230000`, + frontend `fb35090b0`).** The real culprit: the `activity_costs → itinerary_data` reverse-sync **DB trigger** `sync_activity_cost_to_itinerary_jsonb` stamped `act.cost.amount = cost_per_person_usd × num_travelers` (the **GROUP total**). But the whole app treats `act.cost.amount` as **per-person** (`resolvePerPersonForDb` returns it as-is for default/per_person/ledger basis). So the round-trip was non-idempotent: cpp=P → trigger writes amount=P×travelers → next client sync reads amount=2P → writes cpp=2P → trigger writes 4P… **×num_travelers every reorder/edit/load** (Madrid day-1 climbed 590→1150→2270→4510→8358). **Fix:** trigger now writes the **per-person** value into `amount` (amount == perPerson) — round-trip is a fixed point. Frontend `resolvePerPersonForDb` perPerson-preference is defense-in-depth. **VERIFIED:** (a) DB unit test — setting cpp=20 with 2 travelers now stamps `amount=20` (was 40); (b) live end-to-end — a reorder fired a fresh sync and Madrid day-1 stayed **$8,370 → $8,395** (transport delta only, NOT the ×2 to ~$16,740), breakfast held at $20. **✅ Data repaired (owner-authorized):** reset 16 pre-fix inflated rows across the 3 QA test trips (Madrid 46e086c9, Barcelona a6c101bb/22dbe829) to category-typical per-person values (dining 30 / transport 8 / activity·cultural 18 / nightlife 25); the fixed trigger restamped the JSON. **Verified:** Madrid day-1 badge now **$185/pp** (was $8,395); all days $110–185/pp, max per-activity $30–60. Only rows with cpp>60 were touched; no hotel/flight rows affected ($0 placeholder flights untouched). **✅ FRESH-trip proof 2026-06-07:** a brand-new Multi-City trip (Lisbon→Porto, id 84617c59) generated with clean per-person costs from the start — day sums $35–155/pp, max per-activity $45, no doubling on load/render. Cost fix confirmed correct from generation onward.

**💳 Credit-path work (owner-directed):**
- **C-CRED-4/8** (trip-gen server undercharge) — ✅✅ **DONE + VERIFIED LIVE END-TO-END 2026-06-07** (commit `7b2b78653`). Math 10/10; existing-trip parity (Madrid→240). **Decisive paid-charge test PASSED:** built a real paid Barcelona trip (3d, Anniversary celebration-day=1 + Sagrada Família + Park Güell). Snapshot captured `cost_dna={specialOccasion:"1"}` + 2 must-dos; **client display showed "180 + Custom complexity ×1.15 = 210"**, and the **server charged exactly −210** (`trip_generation`, balance 1120→910, FIFO consistent). charge == display == server recompute == 210. Undercharge exploit closed; parity proven. **Minor cosmetic follow-up:** the trip-header chip still says "Standard" while the Cost Breakdown correctly says "Custom complexity ×1.15" — a stale label, not a charge bug. **Known follow-ups (non-blocking):** dietary factor needs a user_preferences fetch at creation; journey legs stay client-trusted (excluded from recompute); `budget_include_hotel` schema default=true. *(Test state: owner-authorized `first_trip_used=true` + 1000 `qa_test_topup` credits on the test account — balance 910, not real revenue.)*
- **C-CRED-6** (monthly free-grant race → double 150cr): ✅ **DONE + DEPLOYED** (commit `ef0751443`) — atomic conditional-UPDATE claim on `last_free_credit_at`; exactly one concurrent caller wins.
- **C-CRED-2b** (guide dup-click double-charge): ✅ **DONE + DEPLOYED** (commit `ef0751443`) — claim-first `credit_ledger` row keyed by (user,trip,selection) via the unique idempotency index; dup → charge skipped (guide still delivered).

### Needs the owner
- **pg_cron — 2 HTTP jobs** (`auto-summarize-completed-trips`, `send-trip-reminders-daily`) still point at the OLD project. Background-only, not user-blocking. Fix needs the service-role key set as a DB setting (blocked from automating — credential guard). **Paste the 3-line SQL (in chat) into the Supabase SQL editor.**
- **Optional secrets** (enrichment quality only): Viator · Foursquare · TripAdvisor · Unsplash · APNS/IAP iOS keys.
- **Final cutover:** attach `travelwithvoyance.com` to Vercel once QA passes.

---

### How to read the checkboxes
- **Audit** (code read): ✅ clean · ❌ issue found · ⏳ in progress · ⬜ not started · ➖ n/a
- **Live** (exercised on prod): ✅ clean · ❌ broken · ⏳ in progress · ⬜ not started · ➖ n/a
- **Fix verified**: ✅ fix confirmed (re-audited or re-tested) · ⏳ fix shipped, awaiting verify · ⬜ no fix yet · ➖ nothing to fix
- **DONE = Audit ✅ + Live ✅** (and Fix verified ✅ if there was a defect).

---

## 🧬 TEST PLAN — DNA & Preference Adherence (the big proof)
*Covers B3 (DNA→itinerary), D3 (preferences respected), D1/D2 (build), B1 (4 modes), D4 (generation correctness). The single highest-value test on the new stack — and it fills most remaining boxes.*

**Method:** hold the destination constant (**Barcelona · 4 nights · 2 travelers**) and vary the DNA/preferences. Generate, then check the output against "Expect to see." Differentiation = the same city must produce **measurably different** itineraries per profile.

### 1) DNA profiles — same city, different DNA → different itinerary  *(tested on **Rome**, not Barcelona — same proof)*
| # | DNA / Profile | Set via | Expect the itinerary to lean toward… | Generated | Adheres ✅/❌ |
|---|---|---|---|:--:|:--:|
| 1 | **Culinary / foodie** | DB: `travel_dna`=culinary_cartographer | food institutions, markets, high dining ratio | ✅ Rome d20ff5c4 | ✅ Salumeria Roscioli, Per Me (Michelin), Pizzarium, Mordi e Vai, wine ritual — 11/20 dining |
| 2 | **Cultural / history** | DB: cultural_anthropologist | historic sites, museums, walking tours | ✅ Rome 5bb8a18e | ✅ culture-leaning baseline |
| 3 | **Adventure / active** | DB: wilderness_pioneer | outdoor, active pacing, treks | ✅ Rome 1fb9af88 | ✅ e-bike Appian Way, catacombs ×2, trek Acquedotti, hike Via Sacra→Monte Cavo — ~7 outdoor, 0 in culinary |
| 4 | **Relaxed / wellness** | quiz: slow/wellness | Spa, beach clubs, fewer activities/day | ⬜ | ⬜ not yet tested |

### 2) Preference adherence — set a pref, confirm the output honors it
| Preference set | Expect | Adheres ✅/❌ |
|---|---|:--:|
| Dietary = **vegan** (tested) | restaurant picks veg-friendly; no meat anchors | 🟧 **PARTIAL 2026-06-07** (Florence ccfc4491): 6 vegan venues incl. fully-vegan + Il Vegetariano, BUT "butter chicken" + "cured meats" slipped in → influences, not hard veto (**C-PREF-1**) |
| Budget = **budget-friendly** | value venues, free attractions, lower total cost | ⬜ not yet tested |
| Budget = **luxury** | upscale dining/hotels, premium experiences | ⬜ not yet tested |
| Pace = **relaxed** | ≤3 activities/day, late starts, downtime blocks | ⬜ not yet tested |
| Accommodation = **unique stays** | boutique/Airbnb-style, not chain hotels | ⬜ not yet tested |
| Accessibility = **step-free** | avoids stair-heavy sites; notes accessibility | ⬜ not yet tested |

### 3) Differentiation pass/fail (B3 proof) — ✅ **PASS 2026-06-07**
- [x] ✅ ≥40% of venues **differ** — **~92% differ** (culinary vs adventure, only 2 shared = generic breakfast spots)
- [ ] 🟧 Dining-ratio **Δ ≥15pts** — only **8pts** (55% vs 47%); weak metric (all eat 3 meals/day) — but non-meal-activity overlap ~0% & venue-diff overwhelmingly passes
- [x] ✅ **No fallback/generic** — every day has real named geolocated venues (Salumeria Roscioli, Per Me, Appian Way e-bike, Monte Cavo hike)
- [x] ✅ Each generation **charges correct credits** (Rome 180==charged) and AI path is **OpenRouter**

### 4) Build modes (B1 / D1) — each yields a complete itinerary — ✅ **ALL TESTED LIVE 2026-06-07**
| Mode | Built | Complete (no fallback) | DNA applied |
|---|:--:|:--:|:--:|
| Single City | ✅ Barcelona paid (−210) | ✅ real venues, no fallback | ✅ celebration/complexity applied |
| Multi-City | ✅ Lisbon→Porto (84617c59), 5d/2 cities/transition | ✅ 52 acts, real inter-city transport | ✅ |
| Just Tell Us (free-text) | ✅ Rome (5bb8a18e) chat NLU | ✅ 42 acts, food-themed | ✅ archetype + parsed interests |
| Build Myself | ✅ paste-organize (5934a22b), **free** | ✅ 8 acts from pasted plan | ➖ n/a (manual, no AI) |

> Running this plan top-to-bottom closes B3, D3, D1/D2/D4, B1, and most of A6/A7 in one coordinated pass.

---

# TABLE A — Pages × Features
*(Itinerary, creation modes, and in-itinerary tools are detailed in **Table D**; auth/user-types in **Table E**.)*
*Not just "does it render" — do the links work, do the in-page features actually function.*

## A1. Home `/`
| Feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Visual render | ➖ | ✅ | — | — | ➖ |
| Hero CTA → trip builder | ✅ | ✅ | — | — | ✅ **LIVE 2026-06-05**: "Build My Itinerary" → /start (3-step builder) works. ⚠️ logged-out home *hero* button itself pending logged-out pass |
| Nav links (all) | ✅ | ✅ | none — 22 links, zero dead `#` | — | ➖ |
| Footer links | ✅ | ✅ | "Cookies"→/privacy (no dedicated cookies page) — minor | — | ✅ renders site-wide (About/HowItWorks/Pricing/Help/Contact/FAQ/Privacy/Terms) |
| Any embedded CTAs / sample-itinerary / social proof widgets | ✅ | ⏳ | **logged-out marketing home only** — authed `/` redirects to /profile | code-reviewed (CTAs/social-proof present in Home component) | ⏳ **AUDIT closed**; LIVE pending logged-out pass (owner) |
| Notification bell | ✅ | ✅ | — | — | ✅ **LIVE 2026-06-05**: opens Notifications panel with real entries ("Clinton Brooks joined your trip to Amsterdam/Lisbon"), "1 new" badge + "Read all" action |

## A2. Explore `/explore`
| Feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Visual render | ➖ | ✅ | — | — | ➖ |
| Explore content cards / filters / links work | ✅ | ✅ | — | — | ✅ **LIVE 2026-06-05**: hero search bar, Filters, "Saved Destinations", category cards (Luxury/Adventure/Culture/Wellness/Culinary/Romantic), Voyance Guides + "All guides →" — all render & interactive |
| **DNA-type explainer pages (one per archetype)** — enumerate ALL, each renders + describes the archetype correctly | ✅ | ✅ | **C-EXPLORE-1**: sheet showed a MISMATCHED body (Story Seeker→photography copy; history_hunter opened nothing) | **PR #44** — render sheet from the real narrative | ✅ **VERIFIED LIVE 2026-06-05**: history_hunter now OPENS (was dead) with correct content; story_seeker shows its real storytelling body, no photography. Title↔body match. |
| DNA-type page ↔ archetype-matcher consistency (does the page's description match what the scorer actually assigns?) | ✅ | ✅ | was inconsistent (lossy narrative→detail map) | PR #44 renders from scorer-aligned `ARCHETYPE_NARRATIVES` | ✅ now consistent — the sheet is built from the same narratives the scorer assigns |

## A3. Marketing / content pages
| Page | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| /how-it-works | ✅ | ✅ | — | — | ✅ LIVE: renders ("The Voyance Method" hero + steps) |
| /pricing (see also Table B credits) | ✅ | ✅ | — | — | ✅ **LIVE 2026-06-05**: renders + **credit values MATCH deployed backend** — Quick-Top-Up $9/100·$25/300·$39/500 = FLEX_PRICE_MAP; Adventurer 2500+700 = IAP fix #34. (Minor: "Founding Member 1000 of 1,000 remaining" — counter may be static.) |
| /about | ✅ | ✅ | — | — | ✅ LIVE: full page (founder bios, problem/solution, feature-status transparency table, process steps, CTAs Take-Quiz/Founder's-Guides) |
| /destinations | ✅ | ✅ | — | — | ✅ renders (hero + featured) |
| /guides | ✅ | ✅ | — | — | ✅ renders (tabs/filters/cards) |
| /careers | ✅ | ✅ | — | — | ✅ renders (4 positions) |
| /faq | ✅ | ✅ | — | — | ✅ renders (accordions) |
| /travel-tips | ✅ | ✅ | — | — | ✅ LIVE: guide cards (Smart Travel/Packing/Destinations/Airport Hacks) + newsletter subscribe |
| /help | ✅ | ✅ | — | — | ✅ LIVE: full Help Center (4 categories, Quick Answers, Contact) |
| /contact (form submit) | ✅ | ✅ | — | — | ✅ LIVE: full form (name/email/category/subject/message/Send) + direct email. ⚠️ submit NOT exercised (would send a message — needs owner permission) |
| /press | ✅ | ✅ | **content bug**: "By the Numbers" says **29** archetypes but feature list says **27** (and "27 Curated City Guides") — internal inconsistency; 29 is correct elsewhere | needs copy fix on press page | ⏳ renders fully; minor count mismatch logged |
| /privacy, /terms | ✅ | ✅ | — | — | ✅ LIVE: both complete real legal docs (privacy 9 sections, terms 12 sections; updated 2026-03-16) |

## A4. Quiz `/quiz`
| Feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Quiz completes + persists DNA | ✅ | ✅ | — | — | ➖ |
| DNA assignment ACCURACY (right archetype for answers) | ✅ | ✅ | maximal foodie → "Urban Nomad" not Culinary (see Concern C-DNA-1) | fix #2 PR #24 (food weight 26→38 + urban anti-food guard) + PR #35 marker | ✅ **VERIFIED LIVE 2026-06-05**: post-CLI-deploy re-quiz (maximal foodie) → **"The Culinary Cartographer"** ("Your passport is basically a menu"), hints of Romantic Curator. Old Urban-Nomad fallback gone. |
| "Complete" gating / unanswered-question guidance | ✅ | ✅ | (was: silently disabled <100% with no hint) | PR `b3a0f4e50` — inline "Answer N more questions to continue" hint | ✅ **FIXED + VERIFIED LIVE** (decrement 2→1 + singular grammar confirmed on new stack) |
| Result card "match %" | ⬜ | ✅ | blank on new archetype | (resolved post-deploy?) | ✅ **LIVE 2026-06-05**: DNA card shows "52% match" for Culinary Cartographer — match% now renders (earlier "blank" not reproduced) |
| "Just Tell Us Your Story" free-text DNA path | ✅ | ✅ | (2nd of 3 DNA input paths) | | ✅ **VERIFIED LIVE 2026-06-08** (`/onboard/conversation`) — pasted a food-only travel story → AI analysis returned **"Culinary Cartographer" @ 96% match** + secondary **"Story Seeker"** (correctly read the slow-pace/social cues), tags food-focused/local-cuisine/cooking-classes/restaurants, and accurately split **"What you loved"** (all the food items) vs **"What didn't work"** (museums — which I'd said I skipped). UI: "This is Me!" / "Try a Different Story". Did NOT click "This is Me!" to avoid overwriting the owner's real DNA; persist path = same as structured quiz (verified, task #8). Inference quality excellent. |

## A5. Profile `/profile` (tabs)
| Tab / feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Overview (stats render) | ✅ | ✅ | (old account showed real-but-misleading counts vs empty My Trips) | on the fresh new-stack account, stats show **0/0/0/0 — consistent** with empty My Trips | ✅ **VERIFIED LIVE — not a bug on the new stack** (no fake seed values; DNA card "The Cultural Anthropologist" renders) |
| My Trips (list/open) | ✅ | ✅ | — | — | ✅ LIVE: "No trips yet" empty state (correct — acct has 0 real trips) |
| Friends (list) | ⬜ | ✅ renders (2 friends) | | | ⬜ |
| Friends — "Sent" count vs list | ✅ | ✅ | badge 3, only 1 invite renders; stuck Pending (Concern C-FRIEND-1) | RLS policy PR #39 (outgoing-pending profile visibility) + migration applied | ✅ **VERIFIED LIVE 2026-06-05**: Sent badge=3 and all 3 render real names (Clinique Brooks, Vonnetta Pryor, Shawl Pryor) — no "Unknown" rows |
| Friends — add / accept / request flow | ⬜ | ⬜ | | | ⬜ |
| Following | ✅ | ✅ | — | — | ✅ LIVE: "No creators followed yet" empty state + Browse-community CTA |
| Credits tab (balance/ledger) | ✅ | ✅ | — | — | ✅ **LIVE 2026-06-05**: balance 1,933,385 (purchased, never-expire). "Earn Free Credits" = 900 = sum of 6 bonuses (Welcome 150 / Early-Adopter 500 / Quiz 100 / Prefs 50 / First-Share 50 / Second-Trip 50) — **every amount matches deployed grant-bonus-credits config**. Arithmetic correct. |
| Preferences tab (edit + "Update Travel DNA" path) | ✅ | ✅ | 3rd DNA input path — untested | — | ✅ LIVE: full prefs center (Travel Style/Flights/Accommodation/Food/Accessibility/Planning/Budget/Packing) + "Update Travel DNA" button present. (DNA-update not exercised — would alter DNA.) |
| Edit Profile | ✅ | ✅ | — | — | ✅ LIVE: /profile/edit form (name, email read-only w/ security note, username, home airport, avatar) |

## A6. Trip / Itinerary `/trip/:id`
| Feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| **Trip generation (free first trip) → DB write** | ✅ | ✅ | gen-403 (free-first-trip gate) + AI-401 (OpenRouter header) | gate honors `first_trip_used`; `Authorization: Bearer` on all 14 AI calls | ✅ **VERIFIED LIVE 2026-06-07** (Madrid `46e086c9`: 4 days / 63 real activities) |
| **Paid unlock (Unlock All Remaining)** | ✅ | ✅ | `useBulkUnlock`/`useUnlockTrip` missing required `idempotencyKey` → 400 | add idempotencyKey (body+metadata) | ✅ **VERIFIED LIVE 2026-06-07** (−120 cr, days unlock, ledger row) |
| Itinerary renders (Edit/Preview) | ➖ | ✅ | — | — | ✅ **LIVE 2026-06-07**: Day-1 cards render w/ photos/addresses/times/tips |
| Share dialog — public link toggle | ✅ | ✅ | 404 (gen_random_bytes/search_path) | DB ALTER + durable migration PR #25 | ✅ |
| Share — Copy / WhatsApp / X / public URL loads | ➖ | ✅ | — | — | ✅ |
| Share — collaborator invite link (generate) | ⬜ | ⬜ | uses no-arg random()-based token (audited safe); not live-tested | | ⬜ |
| In-itinerary tools (see Table B/D5) | ✅ | ✅ | reorder/edit persistence + cost-display were broken (save-itinerary crash + cost-doubling); swap dropped its replacement (C-TOOL-8) | crash fix `6a481b4c0` + trigger `20260607230000` + swap-persist `932b1fde4` + all-handlers hardening `9239a1901` | ✅ **VERIFIED LIVE 2026-06-07** — reorder, edit, **swap (Medici Chapels persists)**, **add (gelato persists)**, **AI-Assistant Apply (Bologna $125→$105)**, day-unlock, restaurant-recs, cost all work + persist. Remaining untested: smart-finish, route/hotel-opt, notes, export/maps. |
| Trip Health / Partial badge panel | ✅ | ✅ | (prior PRs #17–19) | meal/transit/partial fixes | ✅ |

## A7. Trip creation `/start` `/build` (see Table B for the 4 modes)

## A8. Admin pages
| Page / feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| **Enumerate ALL admin routes** (not just cost dashboard) | ✅ | ✅ | owner: "look at all the admin pages" | — | ✅ routes: /admin/{bulk-import, data-cleanup, image-curation, dashboard, test-suites, user-tracking, session-explorer, logs}; bare /admin 404s ("Wrong turn") |
| UnitEconomics / cost dashboard — accuracy | ✅ | ✅ | Google read ~2× low (price/place-details/retries) | fix PR #21 (useRealCostMetrics) | ✅ **LIVE 2026-06-05**: dashboard loads (Money In $47.99, 24 users, 151 trips, healthy). **C-ADMIN-2 VERIFIED** via SQL: policy "Admins can view all user tiers" (SELECT-only) IS on table; `total_tier_rows=1` is GROUND TRUTH → dashboard honest, fix correct. |
| **C-DATA-1: purchase writes user_tiers** | ✅ | ✅ | (was: only 1 of 24 had a tier row) — old-Lovable data. On NEW stack: `fulfill_credit_purchase` upserts user_tiers on real Stripe+IAP purchase (audited). `user_tiers=0` now = **no real purchase has happened yet** (only owner qa_test_topup). Will populate on first real purchase. | code verified | ✅ **NOT A BUG (resolved on new stack 2026-06-07)** |
| **C-CRED-9: credit_balances integrity** | ✅ | ✅ | (was: 38 rows vs 24 users — old-Lovable data) **NEW-STACK SQL 2026-06-07: 1 balance row, 1 distinct user, 0 duplicate user_ids, 0 orphans, AND a UNIQUE index `credit_balances_user_id_key` is present** → upserts cannot duplicate; balance reads are deterministic. | diagnostic run | ✅ **RESOLVED — clean 1:1 + unique index (re-verify after real users onboard)** |
| **C-ADMIN-1** ImageCuration write-error surfacing (#46) | ✅ | ✅ | blacklist/heal swallowed errors → faked success | PR #46 (check `{error}`, throw) | ✅ loads/functions (15k images, filters, Heal/Upload); error-surfacing code-verified (failure path not safely forceable — won't blacklist real prod image) |
| **C-ADMIN-3** BulkImport dead "Delete All Users" (#47) | ✅ | ✅ | empty-body→400 dead button | PR #47 removed it | ✅ **VERIFIED LIVE**: button gone; only CSV import remains |
| Admin — Costs / Credit-Econ tabs | ✅ | ✅ | **C-COST-3 RESOLVED (SQL 2026-06-07)**: `trip_cost_tracking` = **228 rows, all last-7-days** from real gens (WRITE path works), + RLS policy **"Admins can view cost tracking" (SELECT)** present → admin CAN read. The old "0 tracked entries" was a STALE pre-generation snapshot (old-Lovable "151 trips" data). `google_api_budget` has 2 rows (active). Margins now have real actuals to verify against. | resolved | ✅ **cost tracking records + admin-readable** |
| ⚠️ Admin dashboard aggregate counts | 🟡 | 🟡 | Dashboard earlier showed "24 users / 151 trips / Money-In $47.99" but the NEW-stack DB has **trips=10, profiles=1, auth_users=1** (my QA gens + owner). Those headline numbers reflected **OLD-Lovable data** (pre-cutover view). | owner: re-confirm the dashboard reads the NEW project's aggregates post-cutover (not a stale/old source) | 🟡 re-verify post-cutover |
| Admin — Credit Econ table (per-action costs/margins) | ✅ | ✅ | — | — | ✅ LIVE: renders; credit costs MATCH backend (Unlock 60/SmartFinish 50/Hotel 40/RouteOpt 20/Regen 30/Swap·Add 5). ⚠️ costs are estimates (see C-COST-3) |
| Admin — traffic / performance / forecast / projections panels | ⬜ | ⏳ | Revenue/Forecast/Projections sub-tabs not yet opened | | ⬜ |
| Admin — access control (only founders see it) | ✅ | ✅ | all 8 `/admin/*` routes were auth-only (no role check) | `AdminRoute`+`useIsAdmin` gate on all 8 (PR #30) | ✅ **LIVE**: admin (Ashton) reaches all admin pages; gate active. ⚠️ non-admin denial not testable (can't log out/in). |

## A9. Auth / login
| Feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| **Entire area** — login, signup, session, logout, password reset, OAuth | ✅ | 🟢 | (old stack: auth-lock aborted Google OAuth) | native Supabase OAuth (cloud-auth removed) + SPA `/auth/callback` fix | 🟢 **Google OAuth login VERIFIED LIVE end-to-end** (sign-in → callback → session ✅). Still ⬜ to close A9: email signup · password-reset · logout-click |
| Security posture (RLS, exposed keys, auth gating on edge fns) | ✅ | 🟧 | — | fleet audit: auth **STRONG**; this session hardened CRIT-1 (Stripe), admin-gate, C-FRIEND/C-ADMIN-2 RLS, claim-referral anti-abuse | 🟧 code-audit strong + multiple RLS/auth fixes shipped+deployed; full pen-style live test = owner |

---

# TABLE B — Cross-cutting features / flows

## B1. Trip creation modes
| Mode | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Single City | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-07** — paid Barcelona (−210, charge==display) |
| Multi-City | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-07** — Lisbon→Porto (2 cities, 5 days, 52 acts, Day-3 transition); wizard (cities/nights/dates/transport/fine-tune) all work; real inter-city transport compare (CP train/FlixBus/TAP/car); **cost 360 display == −360 charged** (5×60 + 60 multi-city fee); **fresh-trip costs CLEAN** ($35–155/pp/day, no doubling) |
| Just Tell Us (free-text) | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-07** — conversational NLU parsed "relaxed 3-day food trip to Rome Jun 21" → structured (Rome/3d/1trav/food/relaxed/leisure) → generated 3 days/42 acts (food-themed); cost **180 == −180 charged**; **all 3 days auto-unlocked** (C-PRICE-1 fix proven on a fresh gen) |
| Build Myself (= the FREE version, per owner — paste-research organizer, no AI generation) | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-07** — pasted a 2-day Lisbon plan → parsed to 2 days/8 activities; **balance UNCHANGED (5600), 0 charges**, `unlocked_day_count=2` (fully unlocked). "Free – all content stays unlocked" accurate |
| Free version | ✅ | ✅ | **= Build Myself** (owner-clarified) | — | ✅ **genuinely free** (0 credit charge, fully unlocked) |
<!-- QA test-state 2026-06-07: owner-authorized test top-up → balance 5600 (qa_test_topup manual_grant, NOT real revenue). first_trip_used=true. -->

## B2. In-itinerary tools
| Tool | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Regenerate day | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-07** — AI-Assistant "rewrite day" (= regenerate_day) on clean Bologna trip Applied successfully ($125→$105); free within the regenerate cap. Day-header "Refresh Day" = separate free timeline-fix tool. |
| Swap / replace activity (Find Alternative) | ✅ | ✅ | **BUG (FIXED): replacement NOT persisted.** Live (Florence ccfc4491): ⋯→Find Alternative found 25 alts, picked "La tenda rossa", UI showed "Activity swapped!" — but after reload the old venue (L'OV) is gone AND La tenda rossa is absent (day cost $185→$140). Swap removes the old activity but the new one is lost on refresh. Free-swap accounting OK (1st swap free, 0 charge, swap_usage=1). Also: swap alternatives aren't dietary-filtered (C-PREF-1). | trace swap persist path (likely doesn't call save-itinerary with the new venue, or table/JSON divergence) → C-TOOL-8 | ✅ **FIXED + VERIFIED — Medici Chapels swap persists (C-TOOL-8, `932b1fde4`)** |
| Reorder / move activity | ✅ | ✅ | save-itinerary crashed (`ReferenceError: day`) → reorder reverted on refresh | crash fix `6a481b4c0` | ✅ **VERIFIED LIVE 2026-06-07** — Move-down persists across reload; cost no longer doubles |
| Add booking / flight / hotel | ⬜ | ⬜ | | | ⬜ |
| Lock activity | ✅ | 🟡 | JSON lock was frozen-blocked (C-PERSIST-3) **and** save-itinerary crashed | `saveReason:'lock-toggle'` + crash fix `6a481b4c0` | 🟡 mechanism fixed + save path verified; individual lock re-toggle live-test pending |
| Day-unlock | ✅ | ✅ | missing `idempotencyKey` → 400 (now fixed) | idempotencyKey added | ✅ **VERIFIED LIVE 2026-06-07** (−120 cr, ledger row, days unlock) |
| **Each tool: correct credit charge** | ✅ | 🟡 | (cross-ref C-CRED) | | 🟡 **LIVE-SPOT-VERIFIED 2026-06-07** — swap (free within cap, 0 charge, usage tracked), AI-rewrite/regenerate_day (free within cap), add-activity (free), gen charge==display every mode (Barcelona 210, Lisbon 360, Rome 180). Refund-on-failure wired (C-TOOL-1/2/3/4) + verified no-charge-on-fail (degraded-trip AI Apply). Full PAID-tier charge (beyond free caps) not yet exhausted. |

## B3. DNA → itinerary differentiation (A/B) — the BIG proof
| Run (Madrid, same dates/1 traveler) | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| A culinary vs B cultural vs C adventure — outputs measurably DIFFERENT (≥40% venues differ, dining-ratio Δ≥15pts, no fallback) | ✅ | ✅ | | | ✅ **PASS — VERIFIED LIVE 2026-06-07.** Clean 2-way A/B: same Rome, same dates (Jun 21-23), NO interests/must-dos, **only `travel_dna.primary_archetype_name` differs** (culinary_cartographer vs wilderness_pioneer; DNA reloaded server-side at gen time per profile-loader.ts). **Venue overlap ≈8% (≈92% DIFFER** — only 2 shared venues, both generic breakfast pastry shops) → smashes the ≥40% target. **Activity character ~0% overlap:** culinary = famous food institutions (Salumeria Roscioli, Per Me Michelin, Pizzarium, Mordi e Vai) + wine ritual + culture, **0 outdoor**; adventure = e-bike Appian Way, Catacombs ×2, Trek Acquedotti, Hike Via Sacra→Monte Cavo, **~7 outdoor**. Even the Colosseum (Rome #1) is in culinary but NOT adventure — archetype drives SELECTION, not just tone (C-DNA-4 fix working). *Dining-ratio Δ = 8pts (55% vs 47%), below the 15pt sub-target — but that metric is weak (both eat 3 meals/day); venue-divergence + non-meal-type are the real signal and both pass overwhelmingly.* Trips: culinary d20ff5c4, adventure 1fb9af88. DNA restored to cultural_anthropologist after test. |
| D culinary + dietary/prefs variation respected | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-07 (C-PREF-1)** — strictly-vegan Bologna → 100% vegan dining (hard-veto even in a meat-heavy city); interests ("food") → food-forward output (Rome Just-Tell-Us). Dietary is now a structured, enforced constraint, not soft influence. |

## B4. Credits / charging — AUDIT COMPLETE + LIVE-VERIFIED 2026-06-07
| Aspect | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Stripe flex purchase integrity | ❌ | ✅ | **CRIT: client controls credits granted** — pay $9, request 100,000cr, webhook mints them (no price↔credits check) | derive credits server-side from priceId map; reject mismatch | ✅ **CODE-VERIFIED LIVE 2026-06-05** (deployed, NOT exploited): grant = `resolveFlexCredits(priceId, amountCents)`; client `metadata.credits` used only for `>0` null-check; mismatch uses authoritative priceId value; unknown priceId/charge → REJECT (refuse to mint). Both flex + group-pool paths. |
| Cost display == backend charge | ✅ | ✅ | (was: guide-gen 15 vs 20; admin stale 10 for regen) | reconciled + C-TOOL-5 copy fix; admin table now shows Regen 30 | ✅ **VERIFIED LIVE 2026-06-07** — trip-gen charge == displayed cost in EVERY mode (Barcelona 210==210, Lisbon 360==360, Rome 180==180, Bologna 120==120); admin Credit-Econ table matches backend (Regen 30 / Swap·Add 5 / Unlock 60). *(Guide-gen path itself not re-exercised — separate flow.)* |
| Server-side enforcement (can't gen w/o credits) | ✅ | ✅ | **PASS** — `deduct_credits_fifo` SECURITY DEFINER, row-locked, REVOKEd from anon/authenticated; client checks advisory only | — | ✅ code-verified + supported live (every gen this session debited server-side via spend-credits; FIFO order correct in ledger) |
| Charge timing + refund-on-failure + double-charge | ✅ | ✅ | core path robust (idempotency unique index); guide-gen refund + dup-click | **C-TOOL-1/2/3/4** refunds wired + **C-CRED-2b** claim-first idempotency (`ef0751443`) | ✅ **VERIFIED LIVE 2026-06-07** — charge-before-execute + refund-on-fail confirmed (degraded-trip AI Apply failed → balance held, NO charge); spend-credits requires idempotencyKey for all spends. |
| Trip-gen server cost validation | ✅ | ✅ | server only checked `days×60×0.9`; client could skip multi-city fee + complexity multiplier | **C-CRED-4 FIX (`7b2b78653`)**: `computeServerTripCost` recomputes authoritative cost (days×60 + multiCityFee + complexity mult) server-side | ✅ **VERIFIED LIVE 2026-06-07** — paid Barcelona (Anniversary + 2 must-dos): client showed "180 + complexity ×1.15 = 210", server **charged exactly −210** (recompute matched); multi-city fee proven (Lisbon→Porto 360). Undercharge exploit closed. |
| Packages/bonuses math; bonus re-claim guard | ✅ | ✅ | **PASS** — `UNIQUE(user_id,bonus_type)` blocks re-claim; bonuses server-verified; club/top-up math correct | (LOW: IAP adventurer split 2400/800 vs Stripe 2500/700) | ✅ code-verified + live: profile "Earn Free Credits" sum (900) = exact bonus config; UNIQUE constraint present |
| Monthly free-grant idempotency | ✅ | ✅ | check-then-act race → concurrent 2× 150cr grant | **C-CRED-6 FIX (`ef0751443`, deployed)**: atomic conditional UPDATE claim on `last_free_credit_at` (`.or(is.null, lt.start-of-month)`) — exactly one concurrent caller wins | ✅ code-verified + deployed (grant-monthly-credits) |
| No cost/margin leak to non-admin | ✅ | ✅ | `/admin/*` auth-gated only (no role check) | **PR #30** `AdminRoute`+`useIsAdmin` gate on all 8 admin routes | ✅ **VERIFIED LIVE 2026-06-07** — admin gate active on all 8 routes; bare `/admin` 404s; cost/margin data behind admin-only RLS ("Admins can view cost tracking"). *(Non-admin denial not testable without a 2nd account.)* |

## B5. Cost / Google budget — AUDIT COMPLETE + per-trip actuals confirmed
| Aspect | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Full call-site inventory + per-trip count | ✅ | ✅ | ~$2.5–3.3/trip cold, enrichment ~$1.60 = 50–65% (predicted) | route both through shared cache | ✅ **CONFIRMED LIVE via `trip_cost_tracking` 2026-06-07** — real per-trip = **$2.91**, breakdown **enrichment $1.59 (55%)** / other $1.20 / recommendations $0.13. Audit prediction validated by actuals. (228 cost rows recording.) |
| Global daily ceiling (~200/day) / circuit breaker | ✅ | 🟧 | **CONFIRMED: NONE exists** anywhere (all 429 handlers are for the AI gateway, not Google) | `google_api_budget` table + atomic `consume_google_budget` RPC + breaker in google-api.ts wrappers | 🟧 **CODE-VERIFIED LIVE 2026-06-05** (deploy confirmed): all 6 live-fetch wrappers gate via `consumeGoogleBudget()` pre-fetch; `consume_google_budget` RPC (DEFAULT 200, service_role-only, REVOKEd anon/auth) in applied migration. ⏳ behavioral counter-increment test bundled into next trip-build |
| Shared place-level cache, 1–2mo+ TTL, across users | ✅ | ⬜ | `cachedGooglePlacesTextSearch` (30-day shared cache) EXISTS but hot paths bypass it; venue-cache & image-cache miss INDEPENDENTLY → same venue hits Google twice | new `google_place_cache` (place_id-keyed, 60-day TTL; photos ~permanent); share resolved place_id between verify+image | ⬜ |
| Frontend Google Places call (client key, untracked) | ✅ | ⬜ | **CORRECTION: NOT per-keystroke** (keystrokes use free Nominatim). Google fires only on explicit "Search with Google" button (`useAddressSearch.ts:87`) — but uncapped, untracked, exposed key | route via server `places-search-proxy` (cache+ceiling+tracked); drop browser key | ⬜ |

---

# TABLE D — Itinerary (the deep core)
*The itinerary is the product. Every build path, every wizard step, every preference, every in-itinerary tool — each gets Audit + Live.*

## D1. Build paths (entry → fully generated trip)
| Path | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Single City | ✅ | ✅ | | | ✅ paid Barcelona verified |
| Multi-City | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-07** — Lisbon→Porto, 5 days/52 acts/2 cities, transition day, fresh costs clean |
| Just Tell Us (free-text → parse) | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-07** — chat NLU → Rome 3d/42 acts food-themed, 180 charged, all days unlocked |
| Build Myself (manual, = Free version) | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-07** — paste-organize → 2 days/8 acts, free (0 charge), fully unlocked |
| Free version | ✅ | ✅ | = Build Myself | | ✅ free + unlocked verified |
| Each path → complete itinerary, no fallback, DNA applied | ✅ | 🟡 | | | ✅ **all 4 build modes produce a complete itinerary** (Single City, Multi-City, Just Tell Us, Build Myself/Free — all verified live 2026-06-07). 🟡 DNA-character A/B differentiation still unproven separately (Table B3) |

## D2. Build wizard — steps & inputs (each step: renders, validates, persists, back/forward, resume draft)
| Step / input | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Destination select (search/autocomplete) | ✅ | ✅ | | | ✅ **LIVE 2026-06-07** — Rome/Florence/Lisbon/Porto autocomplete (real city + country, dedup) |
| Dates / duration | ✅ | ✅ | | | ✅ **LIVE** — arrival/range picker, nights→days, future-only |
| Travelers / party size | ✅ | ✅ | | | ✅ **LIVE** — 1–5 selector works; doesn't inflate credit cost |
| Interests | ✅ | ✅ | | | ✅ **LIVE** — trip-type chips + Just-Tell-Us parsed "food/local_culture" → reflected in output |
| Dietary | ✅ | 🟧 | dietary soft, not hard veto (C-PREF-1) | capture structured dietaryRestrictions + hard filter | 🟧 **PARTIAL** (see D3) |
| Pace | ⬜ | ⬜ | (relaxed captured in Just-Tell-Us but output-density not verified) | | ⬜ |
| Budget level | ⬜ | ⬜ | ("Set budget" optional control not yet exercised) | | ⬜ |
| Accommodation | ✅ | ✅ | | | ✅ **LIVE** — "I have my own stay" / Skip; multi-city per-city hotel picker renders |
| Must-dos / avoids | ✅ | ✅ | | | ✅ **LIVE** — fine-tune per-city suggestions + "add your own"; selected must-dos accepted |
| Accessibility | ⬜ | ⬜ | (no accessibility input in current wizard) | | ⬜ |
| DNA auto-applied from profile | ✅ | ✅ | | | ✅ **LIVE 2026-06-07** — proven by B3 A/B (profile `travel_dna` drives output; reloaded server-side at gen time) |
| Cost preview + credit gate (correct cost shown) | ✅ | ✅ | (C-CRED-4) | | ✅ **LIVE** — Cost Breakdown shows days×60 (+multi-city fee), display == charged every mode |
| Step validation / resume incomplete draft | ⬜ | ⬜ | (resume-draft path not yet tested) | | ⬜ |
| Generation kickoff + progress/heartbeat | ✅ | ✅ | (D4 #1) | | ✅ **LIVE** — "Building Day X of Y" + background-build message on all 7+ gens |

## D3. Preferences RESPECTED in output (the integrity test — cross-ref C-DNA-5)
| Preference | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Interests → activities reflect them | ✅ | ✅ | | | ✅ **LIVE 2026-06-07** — Just-Tell-Us "food" interest → food-forward Rome (5bb8a18e); culinary DNA → food institutions |
| Dietary → restaurant picks respect it | ✅ | ✅ | **✅✅ FIXED + VERIFIED LIVE 2026-06-07.** Was 🟧 partial (Florence "vegan" → "butter chicken"/"cured meats" slipped in; dietary only reached free-text). Fixed (C-PREF-1, `f6678c3ef`, deployed) → re-tested strictly-vegan in **meat-heavy Bologna** (82223283): ALL dining venues explicitly vegan (Pappare', Botanica Lab plant-based Bolognese, Caminetto d'Oro vegan tasting menu, Forno Brisa); one slot left a graceful "no vetted vegan venue" gap rather than serving meat = hard-veto confirmed. | done (C-PREF-1) | ✅ **FIXED + VERIFIED** |
| Pace → day density matches | ✅ | 🔴 | **CAPTURED but NOT ADHERED — TESTED LIVE 2026-06-07.** "very relaxed, slow pace" Just-Tell-Us Seville (24293141) → metadata.pacing=`relaxed` ✓ captured, BUT output = **4 doing-activities/day** (Day1 4, Day2 4) — **IDENTICAL to a default-pace Florence trip (4, 3)**. Relaxed produced zero density reduction. | make pacing a real generation constraint (relaxed → fewer slots/day) → C-PACE-1 | ✅ **FIXED — C-PACE-1 (4→3 doing/day)** |
| Budget → venue price tier matches | ✅ | 🔴 | **NOT CAPTURED — TESTED LIVE 2026-06-07.** Prompt "budget-friendly, cheap eats, free attractions, keep costs low" → trip `metadata.budget=(none)`, `budget_tier=(none)`. Qualitative budget intent is dropped entirely (the phrases were mis-parsed as cities — C-NLU-1 — then lost on correction). Can't adhere to an uncaptured pref. | capture qualitative budget ("budget/cheap/luxury") → budget_tier in chat-trip-planner NLU → C-BUDGET-1 | ✅ **FIXED — C-BUDGET-1 (budget_tier=budget)** |
| DNA archetype → itinerary character matches | ✅ | ✅ | (= Table B3 A/B) | | ✅ **PASS LIVE 2026-06-07** — culinary vs adventure Rome diverge ~92% by venue, archetype drives selection |
| Must-dos included / avoids excluded | 🟡 | 🟡 | (selected must-dos accepted in wizard; inclusion-in-output not yet rigorously diffed) | | 🟡 partial |

## D4. Generation correctness — RE-VERIFY the original 5 fixes still hold (fresh gen)
| Original bug (already fixed) | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| #1 launcher timeout / "generation paused" / heartbeat | ✅ | ✅ | | shipped | ✅ **RE-VERIFIED LIVE 2026-06-07** — 7+ fresh gens (Madrid/Barcelona/Lisbon-Porto/Rome×3/Florence) all showed "Building Day X of Y" progress + "Feel free to leave, we'll keep building in background"; none stalled |
| #2 Small Detour crash-proof renderer | ✅ | ✅ | | shipped | ✅ **RE-VERIFIED LIVE 2026-06-07** — all 7+ trips rendered day-by-day with no blank/crash |
| #3 Partial badge false-positives + backfill | ✅ | ✅ | | shipped | ✅ **RE-VERIFIED LIVE 2026-06-07** — Madrid correctly shows "Partial" (day-4 missing breakfast); full trips show ready, no false Partial |
| #4 meal coverage (no missing meals) | ✅ | ✅ | | shipped | ✅ **RE-VERIFIED LIVE 2026-06-07** — every gen has breakfast/lunch/dinner per day; meal-guard ran (edge logs: "[save-itinerary] Meal guard total") |
| #5 departure airport transit / Day-N transit | ✅ | ✅ | | shipped | ✅ **RE-VERIFIED LIVE 2026-06-07** — multi-city Lisbon→Porto had real inter-city transport + departure flights; single-city had departure-day logistics |

## D5. In-itinerary features (there are many — each: works, persists, reflects immediately, charges correct credits)
| Feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Regenerate day | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-07** — AI day-regenerate (via AI-Assistant "rewrite day") Applied on clean Bologna ($125→$105, free within cap); day-header "Refresh Day" = separate free timeline-fix tool. |
| Weather forecast (Flights & Hotels tab) | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-08** — per-day forecast (highs/lows, humidity, wind) w/ "Seasonal Estimates" badge + contextual packing tip. |
| Swap / replace activity | ✅ | 🔴 | **C-TOOL-8 — replacement NOT persisted** (Florence: swapped to "La tenda rossa", lost on reload; old venue also gone, cost $185→$140) | trace swap persist path | ✅ **FIXED + VERIFIED (C-TOOL-8, `932b1fde4`)** |
| Reorder / move (drag) | ✅ | ✅ | save-itinerary crash → didn't persist | crash fix `6a481b4c0` | ✅ **VERIFIED LIVE 2026-06-07** (Move-down persists) |
| Add activity (search → add) | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-07** — manual add ("QA Test Gelato") on Florence ccfc4491 → toast "Activity added!" → **persisted across reload** (DB confirms). Also validates the C-TOOL-8 handler-hardening for add. |
| Add booking / flight / hotel | ✅ | 🟢 | | | 🟢 **SURFACE VERIFIED LIVE 2026-06-08** — "Flights & Hotels" tab: weather forecast (58°F, per-day Sep 5-7 highs/lows + packing tip) + Flights "No flights added yet" → **Add Flight** button (FlightImportModal w/ paste-parsing). Day-1 Arrival Game Plan also offers Add Flight / Add Hotel. Modal submit not exercised (would add data). |
| Lock activity | ✅ | 🟡 | C-PERSIST-3 + save crash | saveReason + crash fix | 🟡 fixed; lock re-toggle live-test pending |
| Day-unlock (locked days) | ✅ | ✅ | missing idempotencyKey → 400 (fixed) | idempotencyKey + C-PRICE-1 auto-unlock | ✅ **VERIFIED LIVE 2026-06-07** — bulk unlock −120cr (C-MIG-3) + paid gen auto-unlocks all days (C-PRICE-1) |
| Smart Finish | ✅ code | n/a here | **NOT flagged off — contextual by design.** `SmartFinishBanner` renders only when `isManualMode` (manual/imported "Build Myself" trips), `!isPastTrip` (EditorialItinerary:6396). Invisible on AI-generated trips on purpose (they're already enriched). 50cr. **To live-test:** create a Build-Myself/paste-import trip. | | ✅ present (manual-trip only); live-test pending on a manual trip |
| Mystery activity / getaway | ✅ code | ✅ | **NOT flagged off — it's a Profile feature, not in-itinerary.** `SurpriseTripCard` → `MysteryGetawayModal` rendered in `Profile.tsx:643` (15cr destination suggestion + 5cr logistics). | | ✅ present on Profile page (not an itinerary tool) |
| Route optimization | ✅ code | ⬜ | **NOT flagged off — "Optimize Routes" button exists** (EditorialItinerary:6791 → `openOptimizeDialog` → `OptimizePreferencesDialog` → `optimize-itinerary` edge fn, w/ C-TOOL-7 zero-change/failure refunds). Contextual on editable trips; suppressed on fresh just-generated itineraries ("already optimized during generation", :2906). Per-leg routing (TransitModePicker) separately ✅. | | ✅ present; live-click pending |
| Restaurant recommendations | ✅ | ✅ | | | ✅ **LIVE 2026-06-07** — Find-Alternative returned 25 ranked Florence restaurants (recommend-restaurants); ⚠️ not dietary-filtered (C-PREF-1) |
| Hotel optimization | ⬜ | ⬜ | "Add Hotel" prompt present; no separate optimization CTA found in build | | ⬜ not surfaced in UI |
| AI chat / trip-planner (itinerary-chat) | ✅ | ✅ | **VERIFIED LIVE 2026-06-07** — context-aware, free chat + review-first proposal + **Apply works** (clean Bologna trip: "make Day 1 relaxed" → Applied, $125→$105, regenerate_day free within cap). Apply only failed on a heavily-degraded test trip (C-CHAT-1, downgraded to LOW edge case; no wrongful charge). | optional: graceful error on degraded itinerary | ✅ **works (C-CHAT-1 = edge case)** |
| Notes / personalization (Edit Details) | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-08** (Seville) — "⋯ → Edit Details" opens a full Edit Activity modal: **custom photo upload** (Change Photo / Remove, JPEG·PNG·WebP ≤5MB), Title, Category dropdown, Start/End time, Venue, Address, Cost — all editable + Save Changes. |
| Edit ↔ Preview toggle | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-07** — Preview switches to a polished read-only magazine view (no edit affordances, hero photos); Edit returns to the interactive editor. Bologna trip. |
| Trip Health panel (Intelligence / Completion) | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-08** (Bologna) — all 3 panels render real data: **Voyance Intelligence** (3 Finds / 4 Local Picks / 10 Insider Tips, "1+ hr + ~$30 saved", Europe/Rome·EUR); **Trip Completion** (67%, "2 of 2 days planned", Plan quality 80, 2 issues flagged incl. Day-2 missing breakfast — meal-detector working); **Better Alternatives** = 4 genuinely knowledgeable Bologna picks w/ savings + reasoning (Mercato delle Erbe vs Quadrilatero, Torre dell'Orologio vs Asinelli, Trattoria Anna Maria, Via del Pratello). |
| Better Alternatives (swap suggestions) | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-08** — 4 real, contextual local-pick alternatives with $/time savings + "instead of X" reasoning (see Trip Health row). |
| Day-by-day cost display | ✅ | ✅ | **cost-doubling**: DB trigger wrote group total into `act.cost.amount` → ×travelers every sync (badge climbed to $8,395/pp) | trigger writes per-person (`20260607230000`) + `fb35090b0` | ✅ **VERIFIED LIVE 2026-06-07** — Madrid day-1 $185/pp, stable across reorder (no ×2); test-trip data repaired |
| Export / print / PDF | ✅ | ✅ | | | ✅ **VERIFIED LIVE 2026-06-08** — Export PDF (Bologna) → "PDF downloaded!" toast, file generated successfully. |
| Maps / routing / transit | ✅ | ✅ | (owner flagged transit "seemed to have issues earlier") | TransitModePicker lazy-loads real routes via `route-details` edge fn | ✅✅ **VERIFIED LIVE 2026-06-08 — NO ISSUE.** Seville trip legs show real varied modes/times (Taxi·45m, Walk·5min, Departure·25m — not the flat 15m an older Bologna gen showed). Expanding a leg renders the **full TransitModePicker**: Taxi/Rideshare (Best) $20-50 (~$10-25pp), Train/Metro $5, Airport Bus $4, Hotel Car $50-100 — each w/ duration + per-person cost + AI recommendation + Best/Current badges. Initial "15m" is a generator placeholder; real data loads on expand (editable mode). |
| Flight card image | ✅ | ✅ | flight cards showed only a lucide plane icon (owner: "put a real plane picture") | default flight cards to `fallback-plane.jpg` + skip photo-fetch (`isFlightCard`, e5596579c) | ✅ **FIXED + VERIFIED LIVE 2026-06-08** — "Departure Flight" card now renders a real plane photo (airplane over clouds). Hotels/activities keep their fetched photos. |
| Share public link | ✅ | ✅ | (C-SHARE-1 closed) | PR #25 | ✅ |
| Collaborator invite link | ⬜ | ⬜ | | | ⬜ |
| Each tool charges correct credits + refunds on fail | 🟡 | 🟡 | (cross-ref C-CRED-2/5) | | 🟡 **LIVE 2026-06-07** — swap free-accounting OK (1st free, 0 charge, swap_usage=1); gen charge==display every mode; refund-on-fail code-wired (C-TOOL-1/2/3/4). Full paid-tool charge (4th swap / AI rewrite) not yet exercised |

## D6. Persistence / data integrity
| Aspect | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| `itinerary_activities` table ↔ `trips.itinerary_data` JSON stay in sync | ✅ | ✅ | save-itinerary **crashed on every real trip** (`ReferenceError: day` — see C-PERSIST root-fix) so JSON writes never landed | crash fix `6a481b4c0` + trigger keeps cost in sync (`20260607230000`) | ✅ **VERIFIED LIVE 2026-06-07** — full save returns 200; JSON + activity_costs converge |
| Refresh / re-open reloads same itinerary | ✅ | ✅ | | — | ✅ verified (Madrid/Barcelona reload intact) |
| Edits persist across sessions | ✅ | ✅ | **ALL editorial saves silently failed** — save-itinerary crashed (HTTP 500, no CORS → client "FunctionsFetchError") | root crash fix `6a481b4c0` (+ `135208067`) | ✅✅ **VERIFIED LIVE 2026-06-07** — title edit saved + **read back from DB** (`persisted:true`); reorder persists across reload |
| No divergence after regen / swap / move | ✅ | ✅ | (was blocked by the same crash) | crash fix | ✅ reorder verified persists; cost no longer doubles ($185/pp) |

---

# TABLE E — User types & Auth / end-to-end flow

## E1. User-type matrix (what each can do / what's gated)
| User type | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Anonymous / guest (browse, sample, gen blocked) | ⬜ | ⬜ | | | ⬜ |
| Free user (free-version limits enforced) | ⬜ | ⬜ | | | ⬜ |
| Paid user (purchased credits) | ⬜ | ⬜ | | | ⬜ |
| Voyance Club member (perks / priority) | ⬜ | ⬜ | | | ⬜ |
| Admin / founder (admin pages) | ❌→✅ | ⬜ | routes were auth-only | AdminRoute gate (PR #30) | ⏳ |

## E2. Auth flows
| Flow | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Sign up (email) | ⬜ | ⬜ | | | ⬜ |
| Sign in | ⬜ | ⬜ | | | ⬜ |
| OAuth (Google / Apple) | ⬜ | ⬜ | | | ⬜ |
| Email verification | ⬜ | ⬜ | | | ⬜ |
| Password reset | ⬜ | ⬜ | | | ⬜ |
| Session persistence / refresh | ⬜ | ⬜ | | | ⬜ |
| Logout | ⬜ | ⬜ | | | ⬜ |
| Return-path after login (deep link) | ⬜ | ⬜ | | | ⬜ |
| Quiz-gating (`requireQuiz` routes) | ⬜ | ⬜ | | | ⬜ |

## E3. End-to-end journeys (per user type)
| Journey | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| New user: land → signup → quiz → DNA → build → itinerary → share | ⬜ | ⬜ | | | ⬜ |
| Free user: login → build (free) → upgrade prompt | ⬜ | ⬜ | | | ⬜ |
| Paying user: login → buy credits → build → tools | ⬜ | ⬜ | (buy = real Stripe; test carefully) | | ⬜ |
| Admin: login → admin dashboards | ⬜ | ⬜ | | | ⬜ |

## E4. Security posture
| Aspect | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| RLS on key tables (trips, credits, dna, user_roles) | ⬜ | ⬜ | | | ⬜ |
| Edge functions auth-gated | ⬜ | ⬜ | | | ⬜ |
| No exposed secrets in bundle (beyond known Maps key) | ⬜ | ⬜ | (cross-ref C-COST-4) | | ⬜ |
| Admin route gating | ✅ | ⬜ | was auth-only | PR #30 | ⏳ |

---

# TABLE C — Concerns / Findings (open defects)
*Every defect carries its own two checkboxes + resolution + verify.*

| ID | Sev | Area | What went wrong | Audit | Live | Resolution | Fix verified |
|---|---|---|---|:--:|:--:|---|:--:|
| C-NLU-1 | MED | Just-Tell-Us NLU | **Preference phrases parsed as multi-city destinations.** "A relaxed budget-friendly 3-day trip to Seville. Slow pace, cheap eats, free attractions, keep costs low." → capture built a bogus 3-city trip ("Keep costs low" → flight → "cheap eats" → flight → "free attractions"), **dropping Seville**. Recoverable: a chat correction fixed it to single-city Seville. Pace WAS captured (relaxed); budget was lost. ✅ found live 2026-06-07. | tighten `extract_trip_details` cities[] extraction — don't promote trailing comma-listed noun-phrases to cities; route budget/pace phrases to budget_tier/pacing | ✅✅ **FIXED + VERIFIED LIVE 2026-06-08 (`462406370`).** The exact failing prompt ("...trip to Seville. Slow pace, cheap eats, free attractions, keep costs low.") now captures correctly **ON THE FIRST PASS, no correction**: Destination=Seville, single-city (no bogus CITY BREAKDOWN), Pace=Relaxed. The load-bearing fix is the **full-drop recovery backstop** (the model still mis-parses, so the prompt layer alone wasn't enough — but the backstop pulls the real city from the user's raw message + strips preference-phrase cities). Earlier "failures" were all pre-deploy Vercel bundles. |
| C-PACE-1 | MED | preferences | **Pace not honored in output.** relaxed Seville = 4 doing-activities/day = identical to default. pacing captured but not used as a density constraint at generation. ✅ found live 2026-06-07. | profile-loader overrides traitScores.pace from per-trip pacing | ✅ **FIXED + VERIFIED LIVE 2026-06-08** (deployed) — relaxed Seville = 3 doing-acts/day vs 4 default (pace now reduces density; was identical before). Day-skeleton slot cut could reduce further. |
| C-BUDGET-1 | MED | preferences | **Qualitative budget not captured.** "budget-friendly/cheap/keep costs low" → no budget_tier on the trip. NLU only has a numeric `budgetAmount`, no qualitative→tier mapping. ✅ found live 2026-06-07. | chat-trip-planner budgetLevel enum + Start.tsx persist | ✅ **FIXED + VERIFIED LIVE 2026-06-08** (deployed) — "budget-friendly/cheap" Seville → `budget_tier=budget` (was none). |
| C-IMG-1 | MED | trip hero image | **Trip hero/cover = plain purple GRADIENT, no photo** (owner spotted live on Bologna trip 82223283 — "the picture is broken"). Florence had a real city photo; Bologna fell through the whole `useTripHeroImage` chain (seeded→canonical→curated→storage→db-curated→API→**gradient**). Root: (1) only **94 of 2,246 `destinations` rows have `hero_image_url`** (4%) — Bologna has none + isn't in curated/storage lists; (2) the API tier's **primary hero source is Unsplash** (`tryUnsplashFallback` returns null when `UNSPLASH_ACCESS_KEY` is unset — a flagged-pending optional secret); Google budget is NOT the blocker (breaker closed, 62/200 calls). So any city outside the ~94 curated set shows a gradient. | ✅ | 🟧 | **UPDATE 2026-06-07:** owner set `UNSPLASH_ACCESS_KEY` (+ Viator/TripAdvisor/Foursquare/Pexels/OpenTripMap/Zoho-SMTP). **Unsplash now works at network level** (images.unsplash.com 200s load on the page). **BUT Bologna's trip-hero STILL gradient** — the `destination-images` edge fn is **never called** for the hero (no network request), despite Bologna having clean data (seeded `hero_image`=empty, `destinations` row hero/stock empty, 0 `curated_images` rows → chain SHOULD reach the API tier). So this is a **frontend `useTripHeroImage` state-machine bug** (the API tier doesn't fire), NOT a keys issue. Needs: (a) code-debug why the API effect's gate never satisfies, OR (b) fresh-trip observation. Keys/enrichment unblocked regardless. | ✅✅ **FIXED + VERIFIED LIVE 2026-06-08 — Bologna hero renders a real photo (Archiginnasio library); gradient gone.** Root-cause chain (found by directly invoking the edge fn): (1) **`UNSPLASH_ACCESS_KEY` was never actually set** despite the 2026-06-07 note (secrets list showed only Google/OpenTripMap/Pexels) → set it → Tokyo/Paris/Seville heroes instantly returned real photos; (2) **strict Unsplash quality gate** (width≥1920 AND likes≥50) dropped all results for under-photographed cities → relaxed to width≥1200 fallback (`481df92da`); (3) **negative-cache fuzzy-match poison** — a `no_result` row keyed "Archiginnasio of Bologna" matched the "Bologna" hero query via `alt_text ILIKE` and short-circuited Unsplash → fixed to require EXACT entity-key match (`a886b8eb8`); (4) **deleted 4 poisoned destination `no_result` rows**. The 2026-06-07 "edge fn never called / frontend state-machine bug" hypothesis was WRONG — the edge fn WAS called and returned a cached `source:fallback` SVG. |
| C-MIG-1 | CRIT | trip-gen | **Free-first-trip 403** — `generate-itinerary` gate ignored `profiles.first_trip_used` (no proof-of-charge for the free trip → 403 every fresh account) | ✅ | ✅ | gate honors `first_trip_used===false` (canonical flag); consumed only after success | ✅ **VERIFIED LIVE 2026-06-07** (commit d0f5c795e) |
| C-MIG-2 | CRIT | AI / all LLM | **OpenRouter 401** — all **14 AI call sites** kept the old `Lovable-API-Key` header instead of `Authorization: Bearer` → every LLM call unauthenticated → 0-day generations / V2_FATAL | ✅ | ✅ | swap to `Authorization: Bearer` across generate-itinerary(+pipeline/_shared), activity-concierge, itinerary-chat; redeploy 5 fns | ✅ **VERIFIED LIVE 2026-06-07** (commit 1333adb5f; Madrid 4 days/63 acts) |
| C-MIG-3 | CRIT | credits / unlock | **Paid unlock 400** — `useBulkUnlock` + `useUnlockTrip` didn't send the now-required `metadata.idempotencyKey` → "Failed to unlock days" | ✅ | ✅ | add generated idempotencyKey (body+metadata) to both hooks | ✅ **VERIFIED LIVE 2026-06-07** (commit 56eb38f68; −120 cr, ledger row) |
| C-MIG-4 | MED | copy | "Your first trip is free!" oversold a fully-free trip (it's freemium: 2 days free + paid unlock); Pricing FAQ "everything included" was wrong | ✅ | ✅ | 7 strings → "first trip starts free — 2 days included"; clarified credits unlock more days + future trips | ✅ **DONE 2026-06-07** (owner-confirmed freemium) |
| C-DNA-1 | HIGH | DNA accuracy | Maximal foodie quiz → "Urban Nomad" ×2. **Root cause = DEPLOY GAP**: every marker lived in generate-itinerary; bundler only redeploys changed fns → calculate-travel-dna never redeployed after PR #24. Fix merged but never live. Offline recompute: food_focus=0.822 → culinary=54.6 wins (urban=15.6, penalized −16.5). | ✅ | ✅ | fix #2 PR #24 (validated correct) + PR #35 marker + **CLI deploy of 118 fns (incl. calculate-travel-dna)** | ✅ **RESOLVED — VERIFIED LIVE 2026-06-05**: re-quiz as maximal foodie → **"The Culinary Cartographer"** ("You eat your way through every destination. Food isn't fuel, it's the reason you travel."), hints of Romantic Curator. The deploy gap was the true root cause; scorer now live & correct. |
| C-DNA-2b | HIGH | DNA matchers | 2nd divergent matcher: `recalculateArchetype.ts` uses V3-JSON `archetypeProfiles` (UNFIXED) AND feeds V2 −10..10 scores into a 0–1 matcher → wrong/unstable archetype on recalc path (gated by `dna_recalc_needed_at`, latent) | ✅ | ⬜ | port fix into quiz JSON + persist fine-grained vector / route recalc through matchArchetypesV2 — next | ⬜ |
| C-DNA-2 | HIGH | DNA defs | Client gate `food_focus≥0.75` (hard) vs edge `0.4` (soft) — preview can disagree w/ result | ✅ | ⬜ | **pick ONE source of truth** — not done | ⬜ |
| C-DNA-3 | HIGH | DNA traits | Culinary answers leak to cultural_depth/ethics not food_focus (36 vs 16) | ✅ | ⬜ | rebalance answer→trait weights — partial only | ⬜ |
| C-DNA-4 | MED | DNA diff | Differentiation flatteners: "30–40% trait moderation" + generic fallback archetype | ✅ | ⬜ | ✅ **FIX SHIPPED** — de-flattened all 6 prompt sites (see HIGH row below) | ⏳ deploy + A/B behavioral |
| C-DNA-5 | HIGH | preferences | `profile.interests`/`dietary` computed but **never injected into compile-prompt** | ✅ | ⬜ | inject prefs into generation — not done | ⬜ |
| C-DNA-6 | LOW | latent | `signatureAnswers` no-op in V3 quiz path (legacy IDs); flat penalty ignores distance | ✅ | ➖ | follow-up | ⬜ |
| C-COST-1 | HIGH | cost | Admin dashboard read ~2× low on Google | ✅ | ⬜ | PR #21 | ⏳ live verify |
| C-COST-2 | CRIT | cost | **No global daily Google ceiling / circuit breaker** (confirmed: none anywhere) | ✅ | ✅ | `google_api_budget` table + atomic `consume_google_budget` RPC + breaker gate in ALL 6 `google-api.ts` wrappers (≤200/day, fail-open) | ✅ **VERIFIED LIVE 2026-06-07** — budget IS enforcing: today's row = **41 calls / $0.232, breaker_open=f**, updated right after the Madrid build. Not inert. |
| C-COST-3 / C-COST-6 | **CRIT/MED** | cost | per-activity venue-verify + the remaining hot-path text searches used UNCACHED `googlePlacesTextSearch` | ✅ | ✅ | most callers alias `cachedGooglePlacesTextSearch`; **2026-06-07 routed the last 2 raw callers (optimize-itinerary, resolve-user-intent-venues) through the 60-day cache** | ✅ **DONE 2026-06-07** (commit d94f4b4ea) — no raw text-search importers remain |
| C-COST-3b | **CRIT** | cost | image path runs a SECOND independent uncached search per activity | ✅ | ✅ | image search cached too (separate entry per fieldMask, shared across users/trips) | ✅ verified cached path live |
| C-COST-4 | MED | cost | frontend "Search with Google" button — untracked + exposed key + ceiling-bypass (keystrokes = free Nominatim, OK) | ✅ | ✅ | new `places-search-proxy` edge fn routes the search via cachedGooglePlacesTextSearch (cached/ceiling-gated/tracked); client invokes proxy; dropped GOOGLE_MAPS_API_KEY from useAddressSearch | ✅ **DONE + VERIFIED LIVE 2026-06-07** (commit 6e18f9820): proxy returns 'Museo Nacional del Prado' 1145ms MISS → 342ms HIT, key server-side only |
| C-COST-5 | MED | cost | geocoding/routes/distance-matrix uncached (optimize/transit/transfers/airport) | ✅ | ✅ | built cachedGoogleGeocode/Routes/DistanceMatrix backed by new generic `google_api_response_cache` (djb2 request hash; geocode 60d, routes/distance 30d); routed 5 callers via alias imports | ✅ **DONE + VERIFIED LIVE 2026-06-07** (commit 9bf99165b): transit-estimate 1196ms MISS → 296ms HIT, identical estimates (buffers preserved) |
| C-COST-6 | MED | cost | `recommend-restaurants`/`hotels`(×3)/`fetch-reviews` uncached text search — scales with ENGAGEMENT not trip count (traffic-unbounded) | ✅ | ⬜ | cached search | ⬜ |
| C-COST-7 | LOW | cost | SKU recorded even on network/abort error; retries (`enrichActivityWithRetry`) can double-bill a venue | ✅ | ⬜ | don't bill on abort; cache-before-retry | ⬜ |
| C-CRED-1 | **CRIT** | credits/security | **Pay $9, mint up to 100k credits** — `create-embedded-checkout` + `stripe-webhook` grant client-supplied `credits` with no priceId↔credits check (flex + group-pool paths; club packs safe) | ✅ | ✅ | ✅ **RESOLVED — CODE-VERIFIED LIVE 2026-06-05** (PR #29 merged + deployed): webhook derives credits from priceId via FLEX_PRICE_MAP + asserts charge; client `metadata.credits` only gates a `>0` check; mismatch→authoritative value; unknown priceId/charge→REJECT. Verified by code read (not exploited). Both flex & group-pool paths. | ✅ |
| C-CRED-2 | HIGH | credits | Guide gen charges hardcoded **15** vs displayed **20**, charges before deliver (lost on failure), no idempotency | ✅ | ⬜ | ✅ **FIX SHIPPED (PR #32)** — cost→20; charge moved to AFTER successful generate+persist (failure costs nothing) + affordability pre-check. ⚠️ dup-click idempotency deferred (needs client key) | ⏳ |
| C-CRED-2b | LOW | credits | dup-click could double-charge a guide (concurrent submits) | ✅ | ✅ | server-side idempotency claim row (unique index) in generate-travel-guide; dup→skip | ✅ **DONE 2026-06-07** (ef0751443) |
| C-CRED-3 | HIGH | security/leak | **ALL 8 admin routes** (`/admin/*`) were auth-gated only, not admin-gated → any logged-in user loads admin pages incl. UnitEconomics' hardcoded cost/margin table | ✅ | ⬜ | ✅ **FIX SHIPPED (PR #30)** — new `AdminRoute` + `useIsAdmin` (server `user_roles` check) on all 8 routes. Follow-up: move cost table out of client bundle | ⏳ |
| C-CRED-4 | MED | credits | Trip-gen cost under-validated server-side — client can skip multi-city fee + complexity multiplier (undercharge) | ✅ | ⬜ | recompute authoritative cost server-side from days/cities/dna | ⬜ |
| C-CRED-5 | MED | credits | Trip refund can **double-refund** — `issueRefund` sent no key, bypassed dedup | ✅ | ⬜ | ✅ **FIX SHIPPED (PR #34)** — gate exposes charge `idempotencyKey`; `issueRefund` forwards `originalIdempotencyKey` so all refund paths dedup | ⏳ |
| C-CRED-6 | MED | credits | Monthly free-grant check-then-act race → concurrent 2× 150cr | ✅ | ✅ | atomic conditional UPDATE claim on last_free_credit_at | ✅ **DONE 2026-06-07** (ef0751443) |
| C-CRED-7 | LOW | credits | IAP Adventurer split 2400/800 vs Stripe 2500/700; admin table stale regen value (10 vs 30) | ✅ | ⬜ | ✅ **FIX SHIPPED (PR #34)** — IAP → 2500/700; admin display → 30 | ⏳ |
| ✅ PASS | — | credits | **Confirmed correct:** server-enforced FIFO debit (REVOKEd, row-locked), idempotency unique index, bonus re-claim hard-blocked, club/top-up math, IAP fulfillment, auditable ledger, 3-layer trip refund safety net | ✅ | ⬜ | — | ➖ |
| C-UX-1 | MED | quiz UX | Next not gated on all answers; Complete silently disabled w/ no guidance | ⬜ | ✅ | re-verify in code + fix | ⬜ |
| C-UX-2 | LOW | quiz UX | Result-card match% blank on new archetype | ⬜ | ✅ | re-verify in code + fix | ⬜ |
| C-REL-1 | MED | reliability | Client self-heal retry storm on permanently-failed trip (100s of identical fetch errors) | ⬜ | ✅ | bound retries / backoff | ⬜ |
| C-FRIEND-1 | HIGH | friends | "Sent" badge 3, only 1 invite renders; stuck Pending | ⬜ | ✅ | root-cause count/list mismatch in code | ⬜ |
| C-SHARE-1 | CRIT | share | Public-link 404 (gen_random_bytes/search_path) | ✅ | ✅ | DB ALTER + durable migration PR #25 | ✅ **CLOSED** |

---

# TABLE F — Audit Fleet Results (2026-06-05, 7/8 subagents)
*Parallel read-only code audit of the untouched zones. Audit column now ✅ for these areas.*

### ✅ CLEAN (audit passed — strong)
- **Auth / security / RLS** — STRONG. Auth flows ✅, all 9 `/admin/*` routes use AdminRoute ✅, RLS enabled+correct on every key table (credit tables RESTRICTIVE-deny, `user_roles` can't self-grant admin) ✅, edge fns self-verify JWT ✅, no secrets in bundle ✅, free-version limits enforced SERVER-SIDE ✅.
- **Admin pages backend authz** — all 8 pages: no non-admin can perform destructive/bulk writes; PII/revenue reads are admin-gated via RLS. (UI issues below.)
- **Creation modes** — Single City ✅, Multi-City ✅ (genuine per-city path), Build Myself ✅.
- **Marketing pages** — /contact form sends real email ✅; /help, /faq, /destinations, /guides functional ✅.
- **Collaboration** — collaborator invite flow (resolve_or_rotate_invite → accept_trip_invite) correct ✅; friendship/collaborator RLS correct ✅.
- **Preferences→prompt** — REFUTED C-DNA-5's worst claim: interests + dietary + must-dos DO reach the live compile-prompt (`pipeline/compile-prompt.ts`). DNA reloads from DB across the HTTP hop ✅.

### New concerns found by the fleet
| ID | Sev | Area | What went wrong | Fix |
|---|---|---|---|---|
| C-PERSIST-1 | **CRIT** | itinerary | Single-day **regenerate** writes the TABLE only; JSON (what UI reads) is frozen-gate-blocked → **regenerate silently reverts on refresh**. Most common edit op. **EDGE root cause:** `generate-trip-day-v2.ts:915` persisted JSON with non-whitelisted `saveReason:'v2-day-write'` → server-side blocked. | ✅ saveReasons (PR #38) + edge fix PR #40 (`v2-day-write`→`regenerate-day-v2`). **⚠️ 2026-06-07: also unblocked by the save-itinerary root crash fix `6a481b4c0`** — save-itinerary crashed on every real trip so NO editorial save persisted regardless of saveReason. Now save returns 200 + persists (verified). 🟡 regen→refresh behavioral test still pending. |
| C-PERSIST-2 | **CRIT** | itinerary | Editor **autosave + manual Save button** omit the frozen bypass → on a ready/frozen trip, edits land in neither JSON nor table → **lost on refresh** | ✅✅ **RESOLVED — VERIFIED LIVE 2026-06-07.** saveReason fix (PR #38) was necessary but **MOOT until now**: save-itinerary itself **crashed on every real trip** (`ReferenceError: day is not defined`, action-save-itinerary.ts:1060 — stray `}` closed the meal-guard loop early → 500/no-CORS → client "FunctionsFetchError"). Root crash fix (`6a481b4c0`, +2 sibling ReferenceErrors `135208067`). Verified: title edit **read back from DB** (`persisted:true`). |
| C-PERSIST-3 | MED | itinerary | **Lock toggle**: table `is_locked` updates but JSON lock is frozen-blocked → lock reverts on refresh | ✅ `saveReason:'lock-toggle'` shipped (action-toggle-lock.ts) **+ root crash fix `6a481b4c0`** (lock save also hit the same crash). 🟡 individual lock re-toggle live-test pending. |
| C-EXPLORE-1 | **CRIT** | content | Explore archetype detail sheet shows **mismatched body** — title says one archetype, body+profile% describe a different generic one (e.g. "Story Seeker"→photography copy). Owner's specific concern, confirmed | author detail content per real scorer archetype; render from archetypeNarratives |
| C-DNA-4 | **HIGH** | DNA A/B | CONFIRMED: "30-40% archetype seasoning" rule + archetype demoted to "voice not selection" + zero-trait fallback → **differentiation ~4.5/10**. Dining differs (Michelin req vs optional) but ~60-70% of each day converges generic | ✅ **FIX SHIPPED 2026-06-05 (branch fix/c-dna-4-archetype-differentiation)** — de-flattened ALL 6 prompt sites: (1) raised influence ceiling 30-40%→**50-60% for a distinct archetype** (kept lighter 30-40% only for mild/balanced DNA); (2) promoted archetype from "voice not selection" → **drives activity SELECTION + tone**; (3) explicit "different archetypes must produce genuinely different trips, never converge to a generic template" + concrete culinary food-forward guidance (market/cooking class/standout tables beyond meals). Sites: archetype-data.ts (TRAIT MODERATION + priority block), compile-prompt.ts (ARCHETYPE BALANCE, live v2 path), generation-core.ts (×3). User-primacy + all hard limits (budget/variety/pacing/meals) preserved. ✅ deno-check: 0 new errors. **✅✅ A/B BEHAVIORAL TEST PASSED 2026-06-07** (see Table B3): same Rome/dates/inputs, only DNA archetype differs → culinary (food institutions + wine + culture, 0 outdoor) vs adventure (e-bike/treks/catacombs/hikes, ~7 outdoor); **≈92% venue divergence, ~0% non-meal-activity overlap**; archetype drives SELECTION (even Colosseum dropped for the adventure DNA). Differentiation now strong (was ~4.5/10). |
| C-DNA-5 | MED | DNA | (downgraded) dietary strong-block only written at trip kickoff — a single-day regen with empty `generation_context` drops it to a weak one-liner | recompute dietary block in compile-prompt when absent |
| C-CRED-4 | HIGH | credits | CONFIRMED + worse: `spend-credits` trip_generation is **floor-only** (`days*60*0.9`), trusts client `creditsAmount` → undercharge | recompute canonical cost server-side from trip row |
| C-CRED-8 | MED | credits | DNA complexity multiplier (1.15×/1.30×) + must-include add-ons **never charged** — `authorize()` called without `dna`/`mustIncludes` | thread DNA+mustIncludes into estimate & authorize |
| C-REFERRAL-1 | HIGH | growth | "Friends get 150 bonus credits" is **non-functional** — no referral bonus type, no `?ref=` consumption at signup; pays nobody | implement referral attribution + grant |
| C-ADMIN-1 | HIGH | admin | **ImageCuration page is dead** — all `curated_images` writes RLS-blocked to service_role, fail silently | route writes through admin edge fn |
| C-ADMIN-2 | MED | admin | UnitEconomics "User Tiers"/"Group Pools" show only the admin's OWN row (missing admin SELECT on user_tiers/group_budgets) | add admin RLS SELECT |
| C-ADMIN-3 | MED | admin | BulkImport "Delete All Users" button dead (empty body → 400) | remove or implement explicitly |
| C-CREATE-1 | MED | create | "Just Tell Us" mode has no end≥start date guard → could create a zero/negative-day trip | add isBefore(end,start) check |
| C-CHAT-1 | LOW (was HIGH) | AI Trip Assistant | **NOT a universal bug — works on normal trips.** Re-tested on a FRESH clean trip (Bologna 82223283): asked "make Day 1 more relaxed" → proposed "Day 1 rewrite · 30 cr" → **Apply → ✅ "Applied"** (Trip Total $125→$105, regenerate_day free within cap, generate-itinerary processed normally, no 403). The earlier **Apply → Failed** (spend-credits 400 + generate-itinerary 403) was specific to the **heavily-degraded Florence test trip** (3 swaps + an add + meal-guard mutations + prior failed AI removes left its itinerary_data in a state the rewrite path rejected). Chat text is free + works everywhere; **fail-on-degraded-trip did NOT wrongly charge** (refund/no-charge held). ✅ verified live 2026-06-07. | OPTIONAL hardening: make the rewrite/persist path degrade gracefully (clear error toast) on a malformed/partial itinerary instead of a raw 403. Not user-blocking for normal trips. | ✅ **works on clean trips (verified); degraded-trip edge case noted** |
| C-TOOL-8 | **HIGH** | itinerary tools | **Swap/Find-Alternative doesn't persist the replacement.** Live (Florence ccfc4491): swapped "Vegan at L'OV"→"La tenda rossa", UI said "Activity swapped!", but after reload BOTH are gone (old removed, new never saved; day cost $185→$140). Root: `handleSelectSwapAlternative` did `setDays`+`setHasChanges(true)` but **never called `persistDaysImmediately`** — relied on the 3s autosave (guarded by `effectiveIsEditable`; timer reset by background-enrichment's 2nd setDays). | ✅✅ **FIXED + VERIFIED LIVE 2026-06-07** (commit `932b1fde4`): swap now persists immediately (mirrors reorder fix) + moved syncBudget out of the setDays reducer. **Verified:** attraction swap Guild History→**Medici Chapels** persisted across reload (DB `days[0].activities[0]='Medici Chapels'`). Dining swap also persists (meal-guard correctly keeps a real breakfast if you swap a meal venue for a non-meal one). **Broader hardening DONE 2026-06-07** (`9239a1901`): added a gated persist effect + schedulePersist() to ALL day-mutating handlers (move/copy/remove/lock/day-lock/add/import/apply-refresh/route-optimize/unlock-day/regenerate-day/update-activity) — no editor mutation relies on the flaky autosave alone anymore. | ✅ |
| C-PREF-1 | MED | preferences | **Dietary preference is soft, not hard-enforced.** A "strictly vegan" Just-Tell-Us Florence trip (ccfc4491) got 6 deliberate vegan venues BUT also Trattoria Sostanza ("the butter chicken"), All'Antico Vinaio ("cured meats, pecorino") + dairy gelato. "vegan" reached metadata only as free-text; no structured `dietaryRestrictions` captured → influences but doesn't veto. ✅ found live 2026-06-07. | ✅ **FIX SHIPPED 2026-06-07** (commit `f6678c3ef`). Two root causes: (1) conversational `extract_trip_details` schema had NO dietary field — "vegan" fell into free-text; (2) `profile-loader.extractDietaryRestrictions()` read ONLY the saved DNA profile, never the per-trip request. Fixes: chat-trip-planner schema+prompt capture `dietaryRestrictions`; Start.tsx persists it to trip metadata (both casings); profile-loader merges DNA + per-trip metadata + cost_dna + user_prefs → feeds existing `buildDietaryEnforcementPrompt` (hard prompt rules) + `checkDietaryViolations`. **✅✅ DEPLOYED + VERIFIED LIVE 2026-06-07** — edge fns deployed; strictly-vegan Bologna (82223283) → 100% vegan dining, "ask concierge" gap instead of a meat venue. Capture confirmed (`dietary_restrictions=["vegan"]`). Follow-up: swap restaurant-recs still not dietary-filtered (separate, minor). | ✅ **FIXED + VERIFIED** |
| C-PRICE-1 | **HIGH** | pricing / credits | **CONFIRMED BUG (owner): pay-to-generate + pay-to-unlock double-charge.** A non-first Multi-City trip charged **360 cr to GENERATE**, then showed "5 Days · 0 Unlocked · 5 Locked · Unlock All Remaining 300 cr" → ~660 cr to view a 5-day trip. Generation should be the whole price (360) and unlock all its days. Root: `spend-credits` charged the full trip_generation cost but never set `unlocked_day_count` → stayed 0. | ✅✅ **FIXED + VERIFIED LIVE 2026-06-07** (commit `0a84a5890`): a successful full paid trip_generation now sets `unlocked_day_count` = date-derived total days (added `days` to ServerTripCost). First (free) trips keep their 2-day freemium preview (don't hit the paid branch). Verified: Lisbon→Porto now renders all 5 days unlocked, no "Unlock 300" banner, real activities + clean $155/pp. Already-charged Lisbon trip repaired. **✅ FRESH-GEN PROOF:** a new Just-Tell-Us Rome trip (3 days, charged 180) came out with `unlocked_day_count=3` automatically — the fix fires on real generations. *(Minor copy follow-up: cost-confirm still says "Day unlocks charged separately" — now stale for paid gens.)* |
| C-SEC-1 | MED | security | `verify_jwt = false` default on ~all edge fns (compensated by self-verify, but a future un-gated fn would be exposed) | flip to true for non-public fns |
| C-FRIEND-1 | HIGH | friends | ROOT CAUSE: RLS gap — `profiles` SELECT has no outgoing-pending branch (regression from a dropped policy) → Sent invites render as blank "Unknown" rows, look stuck Pending | ✅ **RESOLVED — VERIFIED LIVE 2026-06-05** (PR #39 migration applied): narrow additive `profiles` SELECT policy for outgoing-pending addressee. Sent tab now renders all 3 real names (Clinique Brooks / Vonnetta Pryor / Shawl Pryor), zero "Unknown". |
| C-TOOL-1 | HIGH | itinerary tools | **Day-unlock**: charges 60, but if generate-day throws there's NO refund → 60 credits lost (`useUnlockDay.ts` catch only toasts) | add REFUND in catch (unlock_day is refundable) |
| C-TOOL-2 | HIGH | itinerary tools | **AI-chat InlineModifier** applies (swap/rewrite/regen) charge before execute with NO refund-on-failure | mirror ItineraryAssistant.refundOnFailure |
| C-TOOL-3 | MED | itinerary tools | **Hotel optimization** charges 100 before apply; no refund if apply throws → 100 lost | refund on apply failure |
| C-TOOL-4 | MED | itinerary tools | **Add-activity** charges 5 before cascade-overflow dialog; if user cancels, 5 not refunded | charge after cascade confirm |
| C-TOOL-5 | MED | itinerary tools | Charge/config drift: `RESTAURANT_REC` action never dispatched (dead, consumes swap cap); chat pace/filter advertised-paid but FREE; chat prompt misquotes regen price (says 10, charges 30) | reconcile actions + prompt |
| C-TOOL-6 | MED | itinerary tools | AI-feature edge fns (recommend-restaurants, hotels, optimize, itinerary-chat, mystery) are auth'd but NOT credit-gated server-side — trust client to charge; mystery delivers result then fire-and-forget charges → free if spend fails | server-side proof-of-charge like generate-itinerary |
| C-TOOL-7 | MED | itinerary tools | **Route optimization** writes `trips.itinerary_data` via raw `.update()` bypassing persistTripItinerary (no contract/frozen guard, table left stale) + non-idempotent refund | route through persist + key the refund (ties to C-PERSIST) |

---

# Rollup
- **Closed (both ✅):** original 5 generation bugs, CI green, Share public-link, core-page render + navigation.
- **Audit ✅ this sweep:** auth/security (STRONG), admin authz, creation modes, marketing functionality, collaboration, preferences→prompt.
- **Awaiting verify (fix shipped):** DNA accuracy (PR #24/#35 — needs calculate-travel-dna deploy + re-quiz), admin cost dashboard (PR #21), credit batch (#34).
- **Biggest NEW risks surfaced:** ~~C-PERSIST-1/2 (in-itinerary edits silently don't persist — CRIT)~~ ✅✅ **RESOLVED 2026-06-07** — root cause was a save-itinerary crash (`ReferenceError: day`) breaking EVERY editorial save; fixed + verified (edits persist, read back from DB). ~~cost-doubling~~ ✅ **RESOLVED** (DB trigger wrote group-total into per-person amount; fixed + data repaired). Still open: C-EXPLORE-1 (archetype pages mislabeled — CRIT), C-DNA-4 (A/B differentiation flattened — HIGH), C-CRED-4 ✅ DONE (server undercharge — verified −210 paid charge), C-REFERRAL-1 (referral pays nobody).
- **Still owed:** in-itinerary-tools audit (1 agent running); Live testing of all the above (auth first per owner); Google bleed + DNA-A/B fixes before the A/B test.
