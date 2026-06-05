# Voyance Travel — QA Master Tracker

**The single source of truth for QA.** Every page, every feature, every concern gets **two independent checks** — a code **Audit** and a **Live** test. An item is only DONE when **both are ✅**. When something fails, we record **what went wrong → the resolution → and verify the fix** before closing.

Env: **prod** (travelwithvoyance.com) · Test credits authorized · Account: ashtonlaurenn@gmail.com
Companion narrative log: `qa/QA-TEST-LOG.md` (detailed findings & root-causes). This file is the structured checklist.

### How to read the checkboxes
- **Audit** (code read): ✅ clean · ❌ issue found · ⏳ in progress · ⬜ not started · ➖ n/a
- **Live** (exercised on prod): ✅ clean · ❌ broken · ⏳ in progress · ⬜ not started · ➖ n/a
- **Fix verified**: ✅ fix confirmed (re-audited or re-tested) · ⏳ fix shipped, awaiting verify · ⬜ no fix yet · ➖ nothing to fix
- **DONE = Audit ✅ + Live ✅** (and Fix verified ✅ if there was a defect).

### Working order (owner-set, 2026-06-05)
1. ✅ Build this tracker
2. ▶️ **Pricing / credits** — prove consistent + accurate (audit running)
3. **Google overspend** — find the bleed + structural fix: ≤~200 Google calls/day regardless of traffic; shared place-level cache for popular destinations, 1–2 month+ TTL (audit running)
4. **Fix standing concerns as we go** — preferences-injection, archetype/trait-leak/differentiation, low-sev — *don't let them pile up*
5. **Then** live testing: DNA accuracy across ALL types, admin pages, page-by-page functionality, DNA→itinerary A/B
6. Fix-and-verify each item before advancing; nothing closes on one checkmark.

---

## 📊 OVERALL PROGRESS  ·  ~3 / ~150 items fully verified  ·  **~2%**
*"Fully verified" = both **Audit ✅ AND Live ✅** (or a defect fixed **and** verified). Most "render ✅" marks are one-sided and do NOT count. Living estimate — updated each pass.*

| Status | Count | What's here |
|---|--:|---|
| ✅ **Fully verified** (both sides) | ~3 | Share public-link (C-SHARE-1), nav links, core-page render |
| 🟡 **Fix shipped — awaiting deploy / re-verify** | 5 | DNA accuracy #24, share-durability #25, cost-dashboard #21, **CRIT credit exploit #29**, **admin-gate #30** |
| 🔵 **Audited (code) — not live-tested** | ~22 | credits core (PASS items), Google cost-bleed, pricing math, DNA root-causes |
| ⬜ **Untouched** (no audit, no live) | ~120 | most of **Itinerary deep (Table D)**, **Auth/user-types/end-to-end (Table E)**, admin pages, the 4 creation modes, free-text & preferences DNA paths |

> **Reality check:** the deepest, highest-value surface — the **itinerary build flow + in-itinerary tools (Table D)** — and the **entire auth / user-type / end-to-end layer (Table E)** are essentially untested. The original 5 generation fixes have **not been re-verified** in this pass (Table D4). We are early — that's the honest picture.

---

# TABLE A — Pages × Features
*(Itinerary, creation modes, and in-itinerary tools are detailed in **Table D**; auth/user-types in **Table E**.)*
*Not just "does it render" — do the links work, do the in-page features actually function.*

## A1. Home `/`
| Feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Visual render | ➖ | ✅ | — | — | ➖ |
| Hero CTA → trip builder | ⬜ | ⬜ | | | ⬜ |
| Nav links (all) | ✅ | ✅ | none — 22 links, zero dead `#` | — | ➖ |
| Footer links | ✅ | ⬜ | "Cookies"→/privacy (no dedicated cookies page) — minor | | ⬜ |
| Any embedded CTAs / sample-itinerary / social proof widgets | ⬜ | ⬜ | | | ⬜ |
| Notification bell | ⬜ | ⬜ | | | ⬜ |

## A2. Explore `/explore`
| Feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Visual render | ➖ | ✅ | — | — | ➖ |
| Explore content cards / filters / links work | ⬜ | ⬜ | | | ⬜ |
| **DNA-type explainer pages (one per archetype)** — enumerate ALL, each renders + describes the archetype correctly | ⬜ | ⬜ | not yet enumerated; owner notes these define "what we target when a user IS a DNA" | | ⬜ |
| DNA-type page ↔ archetype-matcher consistency (does the page's description match what the scorer actually assigns?) | ⬜ | ⬜ | | | ⬜ |

## A3. Marketing / content pages
| Page | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| /how-it-works | ⬜ | ⬜ | | | ⬜ |
| /pricing (see also Table B credits) | ⬜ | ⬜ | | | ⬜ |
| /about | ⬜ | ⬜ | | | ⬜ |
| /destinations | ⬜ | ✅ renders (hero + featured) — **functionality untested** | | | ⬜ |
| /guides | ⬜ | ✅ renders (tabs/filters/cards) — **functionality untested** | | | ⬜ |
| /careers | ⬜ | ✅ renders (4 positions) — **functionality untested** | | | ⬜ |
| /faq | ⬜ | ✅ renders (accordions) — **functionality untested** | | | ⬜ |
| /travel-tips | ⬜ | ⬜ | | | ⬜ |
| /help | ⬜ | ⬜ | | | ⬜ |
| /contact (form submit) | ⬜ | ⬜ | | | ⬜ |
| /press | ⬜ | ⬜ | | | ⬜ |
| /privacy, /terms | ⬜ | ⬜ | | | ⬜ |

## A4. Quiz `/quiz`
| Feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Quiz completes + persists DNA | ✅ | ✅ | — | — | ➖ |
| DNA assignment ACCURACY (right archetype for answers) | ✅ | ❌ | maximal foodie → "Urban Nomad" not Culinary (see Concern C-DNA-1) | fix #2 PR #24 (food weight 26→38 + urban anti-food guard) | ⏳ awaiting edge deploy + re-quiz |
| "Complete" gating / unanswered-question guidance | ⬜ | ❌ | Complete silently disables <100% w/ no "which question" hint | | ⬜ |
| Result card "match %" | ⬜ | ❌ | blank on new archetype | | ⬜ |
| "Just Tell Us Your Story" free-text DNA path | ⬜ | ⬜ | not exercised (2nd of 3 DNA input paths) | | ⬜ |

## A5. Profile `/profile` (tabs)
| Tab / feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Overview (stats render) | ⬜ | ✅ renders | | | ⬜ |
| My Trips (list/open) | ⬜ | ⬜ | | | ⬜ |
| Friends (list) | ⬜ | ✅ renders (2 friends) | | | ⬜ |
| Friends — "Sent" count vs list | ⬜ | ❌ | badge 3, only 1 invite renders; stuck Pending (Concern C-FRIEND-1) | | ⬜ |
| Friends — add / accept / request flow | ⬜ | ⬜ | | | ⬜ |
| Following | ⬜ | ⬜ | | | ⬜ |
| Credits tab (balance/ledger) | ⬜ | ⬜ | | | ⬜ |
| Preferences tab (edit + "Update Travel DNA" path) | ⬜ | ⬜ | 3rd DNA input path — untested | | ⬜ |
| Edit Profile | ⬜ | ⬜ | | | ⬜ |

## A6. Trip / Itinerary `/trip/:id`
| Feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Itinerary renders (Edit/Preview) | ➖ | ✅ | — | — | ➖ |
| Share dialog — public link toggle | ✅ | ✅ | 404 (gen_random_bytes/search_path) | DB ALTER + durable migration PR #25 | ✅ |
| Share — Copy / WhatsApp / X / public URL loads | ➖ | ✅ | — | — | ✅ |
| Share — collaborator invite link (generate) | ⬜ | ⬜ | uses no-arg random()-based token (audited safe); not live-tested | | ⬜ |
| In-itinerary tools (see Table B) | ⬜ | ⬜ | | | ⬜ |
| Trip Health / Partial badge panel | ✅ | ✅ | (prior PRs #17–19) | meal/transit/partial fixes | ✅ |

## A7. Trip creation `/start` `/build` (see Table B for the 4 modes)

## A8. Admin pages
| Page / feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| **Enumerate ALL admin routes** (not just cost dashboard) | ⬜ | ⬜ | owner: "look at all the admin pages" | | ⬜ |
| UnitEconomics / cost dashboard — accuracy | ✅ | ⬜ | Google read ~2× low (price/place-details/retries) | fix PR #21 (useRealCostMetrics) | ⏳ awaiting live open-dashboard verify |
| Admin — traffic / performance panels | ⬜ | ⬜ | | | ⬜ |
| Admin — fixed-cost / projected-cost inputs | ⬜ | ⬜ | | | ⬜ |
| Admin — access control (only founders see it) | ❌→✅ | ⬜ | all 8 `/admin/*` routes were auth-only (no role check) | `AdminRoute`+`useIsAdmin` gate on all 8 (PR #30) | ⏳ |

## A9. Auth / login
| Feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| **Entire area** — login, signup, session, logout, password reset, OAuth | ⬜ | ⬜ | **UNTOUCHED ZONE** — no audit, no test yet | | ⬜ |
| Security posture (RLS, exposed keys, auth gating on edge fns) | ⬜ | ⬜ | | | ⬜ |

---

# TABLE B — Cross-cutting features / flows

## B1. Trip creation modes
| Mode | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Single City | ⬜ | ⬜ | | | ⬜ |
| Multi-City | ⬜ | ⬜ | | | ⬜ |
| Just Tell Us (free-text) | ⬜ | ⬜ | | | ⬜ |
| Build Myself | ⬜ | ⬜ | | | ⬜ |
| Free version | ⬜ | ⬜ | | | ⬜ |

## B2. In-itinerary tools
| Tool | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Regenerate day | ⬜ | ⬜ | | | ⬜ |
| Swap / replace activity | ⬜ | ⬜ | | | ⬜ |
| Reorder / move activity | ⬜ | ⬜ | | | ⬜ |
| Add booking / flight / hotel | ⬜ | ⬜ | | | ⬜ |
| Lock activity | ⬜ | ⬜ | | | ⬜ |
| Day-unlock | ⬜ | ⬜ | | | ⬜ |
| **Each tool: correct credit charge** | ⬜ | ⬜ | (cross-ref C-CRED) | | ⬜ |

## B3. DNA → itinerary differentiation (A/B) — the BIG proof
| Run (Madrid, same dates/1 traveler) | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| A culinary vs B cultural vs C adventure — outputs measurably DIFFERENT (≥40% venues differ, dining-ratio Δ≥15pts, no fallback) | ⬜ | ⬜ | blocked until DNA accuracy + preferences fixes land | | ⬜ |
| D culinary + dietary/prefs variation respected | ⬜ | ⬜ | | | ⬜ |

## B4. Credits / charging — AUDIT COMPLETE
| Aspect | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Stripe flex purchase integrity | ❌ | ⬜ | **CRIT: client controls credits granted** — pay $9, request 100,000cr, webhook mints them (no price↔credits check) | derive credits server-side from priceId map; reject mismatch | ⬜ |
| Cost display == backend charge | ❌ | ⬜ | guide gen charges **15** vs displayed **20**; admin table shows stale 10 for regen (real 30) | reconcile to one value | ⬜ |
| Server-side enforcement (can't gen w/o credits) | ✅ | ⬜ | **PASS** — `deduct_credits_fifo` SECURITY DEFINER, row-locked, REVOKEd from anon/authenticated; client checks advisory only | — | ➖ |
| Charge timing + refund-on-failure + double-charge | ⚠️ | ⬜ | core path robust (idempotency unique index); BUT guide-gen has no refund/idempotency; trip refund can double-refund (un-keyed `issueRefund`) | route guide via spend-credits; key all refunds | ⬜ |
| Trip-gen server cost validation | ❌ | ⬜ | server only checks `days×60×0.9`; client can skip multi-city fee + complexity multiplier (3-city 10-day: pay 540 not 900) | recompute authoritative cost server-side | ⬜ |
| Packages/bonuses math; bonus re-claim guard | ✅ | ⬜ | **PASS** — `UNIQUE(user_id,bonus_type)` blocks re-claim; bonuses server-verified; club/top-up math correct; IAP correct | (LOW: IAP adventurer split 2400/800 vs Stripe 2500/700) | ⬜ |
| Monthly free-grant idempotency | ⚠️ | ⬜ | check-then-act race → concurrent 2× 150cr grant | atomic conditional UPDATE / unique (user,month) | ⬜ |
| No cost/margin leak to non-admin | ❌ | ⬜ | `/admin/dashboard` auth-gated only (no role check); per-action cost/margin table hardcoded in client bundle | add admin-role gate + move cost table behind admin fetch | ⬜ |

## B5. Cost / Google budget — AUDIT COMPLETE
| Aspect | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Full call-site inventory + per-trip count | ✅ | ⬜ | ~$2.5–3.3/trip cold (→~$5 w/ retries+browsing). Dominant driver = **2 uncached text searches/activity** (verify + image) ≈ $1.60/trip = 50–65% | route both through shared cache | ⬜ |
| Global daily ceiling (~200/day) / circuit breaker | ✅ | ⬜ | **CONFIRMED: NONE exists** anywhere (all 429 handlers are for the AI gateway, not Google) | `google_api_budget` table + atomic `consume_google_budget` RPC + breaker in google-api.ts wrappers | ⬜ |
| Shared place-level cache, 1–2mo+ TTL, across users | ✅ | ⬜ | `cachedGooglePlacesTextSearch` (30-day shared cache) EXISTS but hot paths bypass it; venue-cache & image-cache miss INDEPENDENTLY → same venue hits Google twice | new `google_place_cache` (place_id-keyed, 60-day TTL; photos ~permanent); share resolved place_id between verify+image | ⬜ |
| Frontend Google Places call (client key, untracked) | ✅ | ⬜ | **CORRECTION: NOT per-keystroke** (keystrokes use free Nominatim). Google fires only on explicit "Search with Google" button (`useAddressSearch.ts:87`) — but uncapped, untracked, exposed key | route via server `places-search-proxy` (cache+ceiling+tracked); drop browser key | ⬜ |

---

# TABLE D — Itinerary (the deep core)
*The itinerary is the product. Every build path, every wizard step, every preference, every in-itinerary tool — each gets Audit + Live.*

## D1. Build paths (entry → fully generated trip)
| Path | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Single City | ⬜ | ⬜ | | | ⬜ |
| Multi-City | ⬜ | ⬜ | | | ⬜ |
| Just Tell Us (free-text → parse) | ⬜ | ⬜ | | | ⬜ |
| Build Myself (manual) | ⬜ | ⬜ | | | ⬜ |
| Free version | ⬜ | ⬜ | | | ⬜ |
| Each path → complete itinerary, no fallback, DNA applied | ⬜ | ⬜ | | | ⬜ |

## D2. Build wizard — steps & inputs (each step: renders, validates, persists, back/forward, resume draft)
| Step / input | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Destination select (search/autocomplete) | ⬜ | ⬜ | | | ⬜ |
| Dates / duration | ⬜ | ⬜ | | | ⬜ |
| Travelers / party size | ⬜ | ⬜ | | | ⬜ |
| Interests | ⬜ | ⬜ | | | ⬜ |
| Dietary | ⬜ | ⬜ | | | ⬜ |
| Pace | ⬜ | ⬜ | | | ⬜ |
| Budget level | ⬜ | ⬜ | | | ⬜ |
| Accommodation | ⬜ | ⬜ | | | ⬜ |
| Must-dos / avoids | ⬜ | ⬜ | | | ⬜ |
| Accessibility | ⬜ | ⬜ | | | ⬜ |
| DNA auto-applied from profile | ⬜ | ⬜ | | | ⬜ |
| Cost preview + credit gate (correct cost shown) | ⬜ | ⬜ | (cross-ref C-CRED-4) | | ⬜ |
| Step validation / resume incomplete draft | ⬜ | ⬜ | | | ⬜ |
| Generation kickoff + progress/heartbeat | ⬜ | ⬜ | (cross-ref D4 #1) | | ⬜ |

## D3. Preferences RESPECTED in output (the integrity test — cross-ref C-DNA-5)
| Preference | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Interests → activities reflect them | ⬜ | ⬜ | | | ⬜ |
| Dietary → restaurant picks respect it | ⬜ | ⬜ | | | ⬜ |
| Pace → day density matches | ⬜ | ⬜ | | | ⬜ |
| Budget → venue price tier matches | ⬜ | ⬜ | | | ⬜ |
| DNA archetype → itinerary character matches | ⬜ | ⬜ | (= Table B3 A/B) | | ⬜ |
| Must-dos included / avoids excluded | ⬜ | ⬜ | | | ⬜ |

## D4. Generation correctness — RE-VERIFY the original 5 fixes still hold (fresh gen)
| Original bug (already fixed) | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| #1 launcher timeout / "generation paused" / heartbeat | ✅ | ⬜ | (fixed PRs #16–19) | shipped | ⏳ **re-verify live** |
| #2 Small Detour crash-proof renderer | ✅ | ⬜ | | shipped | ⏳ **re-verify live** |
| #3 Partial badge false-positives + backfill | ✅ | ⬜ | | shipped | ⏳ **re-verify live** |
| #4 meal coverage (no missing meals) | ✅ | ⬜ | | shipped | ⏳ **re-verify live** |
| #5 departure airport transit / Day-N transit | ✅ | ⬜ | | shipped | ⏳ **re-verify live** |

## D5. In-itinerary features (there are many — each: works, persists, reflects immediately, charges correct credits)
| Feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Regenerate day | ⬜ | ⬜ | | | ⬜ |
| Swap / replace activity | ⬜ | ⬜ | | | ⬜ |
| Reorder / move (drag) | ⬜ | ⬜ | | | ⬜ |
| Add activity (search → add) | ⬜ | ⬜ | | | ⬜ |
| Add booking / flight / hotel | ⬜ | ⬜ | | | ⬜ |
| Lock activity | ⬜ | ⬜ | | | ⬜ |
| Day-unlock (locked days) | ⬜ | ⬜ | | | ⬜ |
| Smart Finish | ⬜ | ⬜ | | | ⬜ |
| Mystery activity | ⬜ | ⬜ | | | ⬜ |
| Route optimization | ⬜ | ⬜ | (cross-ref C-COST-5) | | ⬜ |
| Restaurant recommendations | ⬜ | ⬜ | (cross-ref C-COST-6) | | ⬜ |
| Hotel optimization | ⬜ | ⬜ | | | ⬜ |
| AI chat / trip-planner (itinerary-chat) | ⬜ | ⬜ | | | ⬜ |
| Notes / personalization | ⬜ | ⬜ | | | ⬜ |
| Edit ↔ Preview toggle | ⬜ | ⬜ | | | ⬜ |
| Trip Health panel (Intelligence / Completion) | ⬜ | ✅ renders | | | ⬜ |
| Day-by-day cost display | ⬜ | ⬜ | | | ⬜ |
| Export / print / PDF | ⬜ | ⬜ | | | ⬜ |
| Maps (Apple MapKit) render | ⬜ | ⬜ | | | ⬜ |
| Share public link | ✅ | ✅ | (C-SHARE-1 closed) | PR #25 | ✅ |
| Collaborator invite link | ⬜ | ⬜ | | | ⬜ |
| Each tool charges correct credits + refunds on fail | ⬜ | ⬜ | (cross-ref C-CRED-2/5) | | ⬜ |

## D6. Persistence / data integrity
| Aspect | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| `itinerary_activities` table ↔ `trips.itinerary_data` JSON stay in sync | ⬜ | ⬜ | (known to diverge — persistDay vs persistTripItinerary) | | ⬜ |
| Refresh / re-open reloads same itinerary | ⬜ | ⬜ | | | ⬜ |
| Edits persist across sessions | ⬜ | ⬜ | | | ⬜ |
| No divergence after regen / swap / move | ⬜ | ⬜ | | | ⬜ |

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
| C-DNA-1 | HIGH | DNA accuracy | Maximal foodie quiz → "Urban Nomad" ×2. **Root cause = DEPLOY GAP**: every marker lived in generate-itinerary; bundler only redeploys changed fns → calculate-travel-dna never redeployed after PR #24. Fix merged but never live. Offline recompute: food_focus=0.822 → culinary=54.6 wins (urban=15.6, penalized −16.5). | ✅ | ❌ | fix #2 PR #24 (validated correct) + **PR #35 marker IN calculate-travel-dna to actually ship it** | ⏳ deploy #35 + final re-quiz |
| C-DNA-2b | HIGH | DNA matchers | 2nd divergent matcher: `recalculateArchetype.ts` uses V3-JSON `archetypeProfiles` (UNFIXED) AND feeds V2 −10..10 scores into a 0–1 matcher → wrong/unstable archetype on recalc path (gated by `dna_recalc_needed_at`, latent) | ✅ | ⬜ | port fix into quiz JSON + persist fine-grained vector / route recalc through matchArchetypesV2 — next | ⬜ |
| C-DNA-2 | HIGH | DNA defs | Client gate `food_focus≥0.75` (hard) vs edge `0.4` (soft) — preview can disagree w/ result | ✅ | ⬜ | **pick ONE source of truth** — not done | ⬜ |
| C-DNA-3 | HIGH | DNA traits | Culinary answers leak to cultural_depth/ethics not food_focus (36 vs 16) | ✅ | ⬜ | rebalance answer→trait weights — partial only | ⬜ |
| C-DNA-4 | MED | DNA diff | Differentiation flatteners: "30–40% trait moderation" + generic fallback archetype | ✅ | ⬜ | verify in A/B + de-flatten | ⬜ |
| C-DNA-5 | HIGH | preferences | `profile.interests`/`dietary` computed but **never injected into compile-prompt** | ✅ | ⬜ | inject prefs into generation — not done | ⬜ |
| C-DNA-6 | LOW | latent | `signatureAnswers` no-op in V3 quiz path (legacy IDs); flat penalty ignores distance | ✅ | ➖ | follow-up | ⬜ |
| C-COST-1 | HIGH | cost | Admin dashboard read ~2× low on Google | ✅ | ⬜ | PR #21 | ⏳ live verify |
| C-COST-2 | CRIT | cost | **No global daily Google ceiling / circuit breaker** (confirmed: none anywhere) | ✅ | ⬜ | `google_api_budget` + `consume_google_budget` RPC + breaker in google-api.ts wrappers (~200/day, degrade to stale/placeholder) | ⬜ |
| C-COST-3 | **CRIT** | cost | **SEV-1:** per-activity venue-verify (`venue-enrichment.ts:218`) uses UNCACHED `googlePlacesTextSearch` → ~20–30 searches/trip ($0.64–0.96) | swap to `cachedGooglePlacesTextSearch` + place_id cache | ⬜ |
| C-COST-3b | **CRIT** | cost | **SEV-1 (biggest):** image path (`venue-enrichment.ts:657`→`destination-images:537`) runs a SECOND independent uncached search + photo/activity, in parallel, regardless of venue cache hit ($0.78–1.17/trip) | share resolved place_id between verify+image; cached search; photo cache by place_id | ⬜ |
| C-COST-4 | MED | cost | **CORRECTED:** frontend Google call is NOT per-keystroke (keystrokes = free Nominatim). Only on explicit "Search with Google" button — but untracked + exposed key + ceiling-bypass | server `places-search-proxy`; drop `VITE_GOOGLE_MAPS_API_KEY` path | ⬜ |
| C-COST-5 | MED | cost | geocoding/routes/distance-matrix uncached (optimize/transit/transfers/airport) | ✅ | ⬜ | add `cachedGoogleGeocode/Routes/DistanceMatrix` wrappers | ⬜ |
| C-COST-6 | MED | cost | `recommend-restaurants`/`hotels`(×3)/`fetch-reviews` uncached text search — scales with ENGAGEMENT not trip count (traffic-unbounded) | ✅ | ⬜ | cached search | ⬜ |
| C-COST-7 | LOW | cost | SKU recorded even on network/abort error; retries (`enrichActivityWithRetry`) can double-bill a venue | ✅ | ⬜ | don't bill on abort; cache-before-retry | ⬜ |
| C-CRED-1 | **CRIT** | credits/security | **Pay $9, mint up to 100k credits** — `create-embedded-checkout` + `stripe-webhook` grant client-supplied `credits` with no priceId↔credits check (flex + group-pool paths; club packs safe) | ✅ | ⬜ | ✅ **FIX SHIPPED (PR #29)** — webhook derives credits from priceId via FLEX_PRICE_MAP + asserts charge; both flex & group-pool paths. Awaiting owner merge + edge deploy | ⏳ |
| C-CRED-2 | HIGH | credits | Guide gen charges hardcoded **15** vs displayed **20**, charges before deliver (lost on failure), no idempotency | ✅ | ⬜ | ✅ **FIX SHIPPED (PR #32)** — cost→20; charge moved to AFTER successful generate+persist (failure costs nothing) + affordability pre-check. ⚠️ dup-click idempotency deferred (needs client key) | ⏳ |
| C-CRED-2b | LOW | credits | dup-click can still double-charge a guide (two successful gens) — charge-after fixed the worst part but not concurrent submits | ✅ | ⬜ | add client idempotencyKey → guard the charge | ⬜ |
| C-CRED-3 | HIGH | security/leak | **ALL 8 admin routes** (`/admin/*`) were auth-gated only, not admin-gated → any logged-in user loads admin pages incl. UnitEconomics' hardcoded cost/margin table | ✅ | ⬜ | ✅ **FIX SHIPPED (PR #30)** — new `AdminRoute` + `useIsAdmin` (server `user_roles` check) on all 8 routes. Follow-up: move cost table out of client bundle | ⏳ |
| C-CRED-4 | MED | credits | Trip-gen cost under-validated server-side — client can skip multi-city fee + complexity multiplier (undercharge) | ✅ | ⬜ | recompute authoritative cost server-side from days/cities/dna | ⬜ |
| C-CRED-5 | MED | credits | Trip refund can **double-refund** — `issueRefund` (ItineraryGenerator) sends no `pendingChargeId`/`originalIdempotencyKey`, bypasses dedup | ✅ | ⬜ | pass original idempotencyKey through all refund paths | ⬜ |
| C-CRED-6 | MED | credits | Monthly free-grant check-then-act race → concurrent 2× 150cr | ✅ | ⬜ | atomic conditional UPDATE / unique (user, month) | ⬜ |
| C-CRED-7 | LOW | credits | IAP Adventurer split 2400/800 vs Stripe 2500/700 (bonus expires, base doesn't); admin table stale regen value (10 vs 30) | ✅ | ⬜ | align IAP split; fix admin display | ⬜ |
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
| C-PERSIST-1 | **CRIT** | itinerary | Single-day **regenerate** writes the TABLE only; JSON (what UI reads) is frozen-gate-blocked → **regenerate silently reverts on refresh**. Most common edit op. | ✅ **FIX SHIPPED (PR #38, frontend)** — autosave + regen-autosave now pass whitelisted `saveReason` |
| C-PERSIST-2 | **CRIT** | itinerary | Editor **autosave + manual Save button** omit the frozen bypass → on a ready/frozen trip, edits land in neither JSON nor table → **lost on refresh** | ✅ **FIX SHIPPED (PR #38)** — autosave/Save + chat-action executor + day-unlock all carry `saveReason` now |
| C-PERSIST-3 | MED | itinerary | **Lock toggle**: table `is_locked` updates but JSON lock is frozen-blocked → lock reverts on refresh | pass `saveReason:'lock-toggle'` |
| C-EXPLORE-1 | **CRIT** | content | Explore archetype detail sheet shows **mismatched body** — title says one archetype, body+profile% describe a different generic one (e.g. "Story Seeker"→photography copy). Owner's specific concern, confirmed | author detail content per real scorer archetype; render from archetypeNarratives |
| C-DNA-4 | **HIGH** | DNA A/B | CONFIRMED: "30-40% archetype seasoning" rule + archetype demoted to "voice not selection" + zero-trait fallback → **differentiation ~4.5/10**. Dining differs (Michelin req vs optional) but ~60-70% of each day converges generic | raise moderation ceiling for high-confidence DNA; promote archetype to selection; concrete extra food slot for culinary |
| C-DNA-5 | MED | DNA | (downgraded) dietary strong-block only written at trip kickoff — a single-day regen with empty `generation_context` drops it to a weak one-liner | recompute dietary block in compile-prompt when absent |
| C-CRED-4 | HIGH | credits | CONFIRMED + worse: `spend-credits` trip_generation is **floor-only** (`days*60*0.9`), trusts client `creditsAmount` → undercharge | recompute canonical cost server-side from trip row |
| C-CRED-8 | MED | credits | DNA complexity multiplier (1.15×/1.30×) + must-include add-ons **never charged** — `authorize()` called without `dna`/`mustIncludes` | thread DNA+mustIncludes into estimate & authorize |
| C-REFERRAL-1 | HIGH | growth | "Friends get 150 bonus credits" is **non-functional** — no referral bonus type, no `?ref=` consumption at signup; pays nobody | implement referral attribution + grant |
| C-ADMIN-1 | HIGH | admin | **ImageCuration page is dead** — all `curated_images` writes RLS-blocked to service_role, fail silently | route writes through admin edge fn |
| C-ADMIN-2 | MED | admin | UnitEconomics "User Tiers"/"Group Pools" show only the admin's OWN row (missing admin SELECT on user_tiers/group_budgets) | add admin RLS SELECT |
| C-ADMIN-3 | MED | admin | BulkImport "Delete All Users" button dead (empty body → 400) | remove or implement explicitly |
| C-CREATE-1 | MED | create | "Just Tell Us" mode has no end≥start date guard → could create a zero/negative-day trip | add isBefore(end,start) check |
| C-SEC-1 | MED | security | `verify_jwt = false` default on ~all edge fns (compensated by self-verify, but a future un-gated fn would be exposed) | flip to true for non-public fns |
| C-FRIEND-1 | HIGH | friends | ROOT CAUSE: RLS gap — `profiles` SELECT has no outgoing-pending branch (regression from a dropped policy) → Sent invites render as blank "Unknown" rows, look stuck Pending | ✅ **FIX SHIPPED (PR #39, migration)** — narrow additive `profiles` SELECT policy for outgoing-pending addressee. ⚠️ needs DB apply (migrations don't auto-deploy) |
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
- **Biggest NEW risks surfaced:** C-PERSIST-1/2 (in-itinerary edits silently don't persist — CRIT), C-EXPLORE-1 (archetype pages mislabeled — CRIT), C-DNA-4 (A/B differentiation flattened — HIGH), C-CRED-4 (server undercharge), C-REFERRAL-1 (referral pays nobody).
- **Still owed:** in-itinerary-tools audit (1 agent running); Live testing of all the above (auth first per owner); Google bleed + DNA-A/B fixes before the A/B test.
