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
| 🔵 Product QA on new stack | **~15%** — foundational pages + core money/build path green; most in-itinerary tools & build modes still untested live |

**Now working through:** driving the whole sheet green (owner directive). (1) re-verify "fixed-but-unproven" defects, (2) fix genuinely-open defects, (3) DNA proof + build modes + auth flows.

### Defect sweep — 2026-06-07 PM (parallel-agent scoped + verified)
**Closed this sweep:**
- ✅ **C-TOOL-1/2/3/4** (refund-on-failure for day-unlock / AI-chat modifier / route-opt / add-activity) — **already correctly wired** in current tree (inline `C-TOOL-N` remediation comments + verified refund paths). No change needed.
- ✅ **C-TOOL-5** (price copy drift) — fixed: pace/filter chat actions advertised 5cr but are free (→0); rewrite badge 10→30; chat prompt "10 credits"→"30". Display/copy only. Deployed.
- ✅ **C-PERSIST-3** (lock toggle reverts on frozen trips) — root-caused: JSON sync was frozen-blocked (no saveReason); added `saveReason:'lock-toggle'` ×3 in action-toggle-lock.ts. Deployed. *(Live re-verify needs a frozen/ready trip.)*
- ✅ **C-CREATE-1** ("Just Tell Us" zero-day trip) — added `isBefore(end,start)` guard in Start.tsx. Deployed.
- ✅ **C-DATA-1** (IAP user_tiers) — **confirmed applied in prod**: `fulfill_credit_purchase` upserts user_tiers (covers both Stripe + IAP paths). Closed.
- ✅ **C-SEC-1** (verify_jwt=false default) — assessed: posture acceptable (truly-public fns verify signatures; data fns self-verify via require-auth). Do NOT flip globally. No change.

**✅ INVESTIGATED — reorder/cost-recompute (C-PERSIST reorder, commit `b7ab6807e`):**
- **Cost "inflation" (170→310→590) = NOT a bug.** `activity_costs` for Madrid day-1 = **15 distinct rows, zero duplicates**, sum **$590/pp, now stable**. $590 is the legitimate full-day total (flamenco + e-bike + museums + lunch + dinner). The earlier lower values were `syncBudgetFromDays` *progressively resolving* per-activity costs across re-renders and converging — no duplication, no double-count. **No fix needed.**
- **Reorder persistence fix = sound + deployed.** `handleActivityReorder` now calls `persistDaysImmediately(newDays)` (mirrors the AI-note path; `hasChanges→false` so no double-save) — closes the *lose-on-fast-navigation* window (the 3s autosave would catch a normal-paced reorder; navigating away sooner lost it). Code-traced correct & low-risk. **⚠️ Live re-confirmation pending:** the activity ⋯ "Move down" Radix dropdown is not reliably drivable via browser automation (coordinate clicks + DOM pointer-event injection both failed to open the portal). Recommend a quick **manual** confirm (reorder → refresh → order sticks) or a re-test later.

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

### 1) DNA profiles — same city, different DNA → different itinerary
| # | DNA / Profile | Set via | Expect the itinerary to lean toward… | Generated | Adheres ✅/❌ |
|---|---|---|---|:--:|:--:|
| 1 | **Culinary / foodie** | quiz: food-forward answers | La Boqueria, tapas crawl, cooking class, dinner reservations, food markets; **high dining ratio** | ⬜ | ⬜ |
| 2 | **Cultural / history** | quiz: culture answers | Sagrada Família, Gothic Quarter, Picasso/MNAC, historic walking tours; **low nightlife** | ⬜ | ⬜ |
| 3 | **Adventure / active** | quiz: adventure answers | Montjuïc, cable car, beach/water sports, Montserrat day-trip, **active pacing** | ⬜ | ⬜ |
| 4 | **Relaxed / wellness** | quiz: slow/wellness answers | Spa, beach clubs, **fewer activities/day**, slow mornings, downtime | ⬜ | ⬜ |

### 2) Preference adherence — set a pref, confirm the output honors it
| Preference set | Expect | Adheres ✅/❌ |
|---|---|:--:|
| Dietary = **vegetarian** | restaurant picks veg-friendly; no steakhouse anchors | ⬜ |
| Budget = **budget-friendly** | value venues, free attractions, lower total cost | ⬜ |
| Budget = **luxury** | upscale dining/hotels, premium experiences | ⬜ |
| Pace = **relaxed** | ≤3 activities/day, late starts, downtime blocks | ⬜ |
| Accommodation = **unique stays** | boutique/Airbnb-style, not chain hotels | ⬜ |
| Accessibility = **step-free** | avoids stair-heavy sites; notes accessibility | ⬜ |

### 3) Differentiation pass/fail (B3 proof)
- [ ] ≥40% of venues **differ** between profiles 1 / 2 / 3 for the same city
- [ ] Dining-ratio **Δ ≥15pts** between Culinary (1) and Cultural (2)
- [ ] **No fallback/generic** itinerary — every day has real, named, geolocated venues (D4)
- [ ] Each generation **charges the correct credits** and the AI path is OpenRouter (D4/B4)

### 4) Build modes (B1 / D1) — each yields a complete itinerary
| Mode | Built | Complete (no fallback) | DNA applied |
|---|:--:|:--:|:--:|
| Single City | ⬜ | ⬜ | ⬜ |
| Multi-City | ⬜ | ⬜ | ⬜ |
| Just Tell Us (free-text) | ⬜ | ⬜ | ⬜ |
| Build Myself | ⬜ | ⬜ | ⬜ |

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
| "Just Tell Us Your Story" free-text DNA path | ⬜ | ⬜ | not exercised (2nd of 3 DNA input paths) | | ⬜ |

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
| In-itinerary tools (see Table B) | ⬜ | ⬜ | | | ⬜ |
| Trip Health / Partial badge panel | ✅ | ✅ | (prior PRs #17–19) | meal/transit/partial fixes | ✅ |

## A7. Trip creation `/start` `/build` (see Table B for the 4 modes)

## A8. Admin pages
| Page / feature | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| **Enumerate ALL admin routes** (not just cost dashboard) | ✅ | ✅ | owner: "look at all the admin pages" | — | ✅ routes: /admin/{bulk-import, data-cleanup, image-curation, dashboard, test-suites, user-tracking, session-explorer, logs}; bare /admin 404s ("Wrong turn") |
| UnitEconomics / cost dashboard — accuracy | ✅ | ✅ | Google read ~2× low (price/place-details/retries) | fix PR #21 (useRealCostMetrics) | ✅ **LIVE 2026-06-05**: dashboard loads (Money In $47.99, 24 users, 151 trips, healthy). **C-ADMIN-2 VERIFIED** via SQL: policy "Admins can view all user tiers" (SELECT-only) IS on table; `total_tier_rows=1` is GROUND TRUTH → dashboard honest, fix correct. |
| 🆕 **C-DATA-1: purchase doesn't write user_tiers** | ⬜ | ❌ | only **1 of 24** users has a `user_tiers` row (just owner=flex) but dashboard counts "2 paid" — a real purchase should upsert a tier row; paying users w/o one lose club-tier tracking (never-expire credits, badges) | audit stripe-webhook/IAP → ensure user_tiers upsert on purchase | ⬜ NEW FINDING (SQL 2026-06-05) |
| 🆕 **C-CRED-9: credit_balances row count > users** | ⬜ | ❌ | `balance_rows=38` vs `auth_users=profiles=24` (14 extra). If MULTI-row per user → **non-deterministic balance reads** (credit-accuracy CRIT); grant/referral upserts use onConflict:user_id which REQUIRES a unique index — if missing, upserts dup instead of update. If orphaned → cleanup. | run multi-row + unique-index + orphan SQL (pending) | ⬜ NEW FINDING (SQL 2026-06-05) — **awaiting diagnostic** |
| **C-ADMIN-1** ImageCuration write-error surfacing (#46) | ✅ | ✅ | blacklist/heal swallowed errors → faked success | PR #46 (check `{error}`, throw) | ✅ loads/functions (15k images, filters, Heal/Upload); error-surfacing code-verified (failure path not safely forceable — won't blacklist real prod image) |
| **C-ADMIN-3** BulkImport dead "Delete All Users" (#47) | ✅ | ✅ | empty-body→400 dead button | PR #47 removed it | ✅ **VERIFIED LIVE**: button gone; only CSV import remains |
| Admin — Costs / Credit-Econ tabs | ✅ | ❌ | **🆕 C-COST-3 (NEW FINDING)**: Costs tab = "0 tracked entries · $0.00" despite **151 trips created** + Money-Out(30d) $0.00. Real API-cost tracking not recording OR admin can't read the cost table (RLS). Credit-Econ "Our Cost" figures are therefore **config estimates, not actuals** → margins unverified against real spend. Also feeds Google-budget enforcement. | diagnostic SQL pending (cost-table row count + google_api_budget + RLS) | ⬜ **NEW — awaiting diagnostic** |
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
| Day-unlock | ✅ | ✅ | missing `idempotencyKey` → 400 (now fixed) | idempotencyKey added | ✅ **VERIFIED LIVE 2026-06-07** (−120 cr, ledger row, days unlock) |
| **Each tool: correct credit charge** | ⬜ | ⬜ | (cross-ref C-CRED) | | ⬜ |

## B3. DNA → itinerary differentiation (A/B) — the BIG proof
| Run (Madrid, same dates/1 traveler) | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| A culinary vs B cultural vs C adventure — outputs measurably DIFFERENT (≥40% venues differ, dining-ratio Δ≥15pts, no fallback) | ⬜ | ⬜ | blocked until DNA accuracy + preferences fixes land | | ⬜ |
| D culinary + dietary/prefs variation respected | ⬜ | ⬜ | | | ⬜ |

## B4. Credits / charging — AUDIT COMPLETE
| Aspect | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Stripe flex purchase integrity | ❌ | ✅ | **CRIT: client controls credits granted** — pay $9, request 100,000cr, webhook mints them (no price↔credits check) | derive credits server-side from priceId map; reject mismatch | ✅ **CODE-VERIFIED LIVE 2026-06-05** (deployed, NOT exploited): grant = `resolveFlexCredits(priceId, amountCents)`; client `metadata.credits` used only for `>0` null-check; mismatch uses authoritative priceId value; unknown priceId/charge → REJECT (refuse to mint). Both flex + group-pool paths. |
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
| Global daily ceiling (~200/day) / circuit breaker | ✅ | 🟧 | **CONFIRMED: NONE exists** anywhere (all 429 handlers are for the AI gateway, not Google) | `google_api_budget` table + atomic `consume_google_budget` RPC + breaker in google-api.ts wrappers | 🟧 **CODE-VERIFIED LIVE 2026-06-05** (deploy confirmed): all 6 live-fetch wrappers gate via `consumeGoogleBudget()` pre-fetch; `consume_google_budget` RPC (DEFAULT 200, service_role-only, REVOKEd anon/auth) in applied migration. ⏳ behavioral counter-increment test bundled into next trip-build |
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
| C-PERSIST-1 | **CRIT** | itinerary | Single-day **regenerate** writes the TABLE only; JSON (what UI reads) is frozen-gate-blocked → **regenerate silently reverts on refresh**. Most common edit op. **EDGE root cause:** `generate-trip-day-v2.ts:915` persisted JSON with non-whitelisted `saveReason:'v2-day-write'` → server-side blocked. | ✅ **CODE-VERIFIED LIVE 2026-06-05** (deploy confirmed): frontend saveReasons (PR #38) + edge fix PR #40 (`v2-day-write`→`regenerate-day-v2`) shipped in CLI deploy of generate-itinerary. Confirmed `frozen-guard.USER_SAVE_REASON_PREFIXES` includes `'regenerate-'` → `isUserSaveReason('regenerate-day-v2')`=true → persist allowed on frozen trip. ⏳ **Behavioral test (regen→refresh→persists) bundled into next trip-build** (no trip exists on test acct yet). |
| C-PERSIST-2 | **CRIT** | itinerary | Editor **autosave + manual Save button** omit the frozen bypass → on a ready/frozen trip, edits land in neither JSON nor table → **lost on refresh** | ✅ **FIX SHIPPED (PR #38)** — autosave/Save + chat-action executor + day-unlock all carry `saveReason` now |
| C-PERSIST-3 | MED | itinerary | **Lock toggle**: table `is_locked` updates but JSON lock is frozen-blocked → lock reverts on refresh | pass `saveReason:'lock-toggle'` |
| C-EXPLORE-1 | **CRIT** | content | Explore archetype detail sheet shows **mismatched body** — title says one archetype, body+profile% describe a different generic one (e.g. "Story Seeker"→photography copy). Owner's specific concern, confirmed | author detail content per real scorer archetype; render from archetypeNarratives |
| C-DNA-4 | **HIGH** | DNA A/B | CONFIRMED: "30-40% archetype seasoning" rule + archetype demoted to "voice not selection" + zero-trait fallback → **differentiation ~4.5/10**. Dining differs (Michelin req vs optional) but ~60-70% of each day converges generic | ✅ **FIX SHIPPED 2026-06-05 (branch fix/c-dna-4-archetype-differentiation)** — de-flattened ALL 6 prompt sites: (1) raised influence ceiling 30-40%→**50-60% for a distinct archetype** (kept lighter 30-40% only for mild/balanced DNA); (2) promoted archetype from "voice not selection" → **drives activity SELECTION + tone**; (3) explicit "different archetypes must produce genuinely different trips, never converge to a generic template" + concrete culinary food-forward guidance (market/cooking class/standout tables beyond meals). Sites: archetype-data.ts (TRAIT MODERATION + priority block), compile-prompt.ts (ARCHETYPE BALANCE, live v2 path), generation-core.ts (×3). User-primacy + all hard limits (budget/variety/pacing/meals) preserved. ✅ deno-check: 0 new errors. ⏳ **A/B behavioral test pending deploy + trip-build** (culinary vs cultural must diverge) |
| C-DNA-5 | MED | DNA | (downgraded) dietary strong-block only written at trip kickoff — a single-day regen with empty `generation_context` drops it to a weak one-liner | recompute dietary block in compile-prompt when absent |
| C-CRED-4 | HIGH | credits | CONFIRMED + worse: `spend-credits` trip_generation is **floor-only** (`days*60*0.9`), trusts client `creditsAmount` → undercharge | recompute canonical cost server-side from trip row |
| C-CRED-8 | MED | credits | DNA complexity multiplier (1.15×/1.30×) + must-include add-ons **never charged** — `authorize()` called without `dna`/`mustIncludes` | thread DNA+mustIncludes into estimate & authorize |
| C-REFERRAL-1 | HIGH | growth | "Friends get 150 bonus credits" is **non-functional** — no referral bonus type, no `?ref=` consumption at signup; pays nobody | implement referral attribution + grant |
| C-ADMIN-1 | HIGH | admin | **ImageCuration page is dead** — all `curated_images` writes RLS-blocked to service_role, fail silently | route writes through admin edge fn |
| C-ADMIN-2 | MED | admin | UnitEconomics "User Tiers"/"Group Pools" show only the admin's OWN row (missing admin SELECT on user_tiers/group_budgets) | add admin RLS SELECT |
| C-ADMIN-3 | MED | admin | BulkImport "Delete All Users" button dead (empty body → 400) | remove or implement explicitly |
| C-CREATE-1 | MED | create | "Just Tell Us" mode has no end≥start date guard → could create a zero/negative-day trip | add isBefore(end,start) check |
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
- **Biggest NEW risks surfaced:** C-PERSIST-1/2 (in-itinerary edits silently don't persist — CRIT), C-EXPLORE-1 (archetype pages mislabeled — CRIT), C-DNA-4 (A/B differentiation flattened — HIGH), C-CRED-4 (server undercharge), C-REFERRAL-1 (referral pays nobody).
- **Still owed:** in-itinerary-tools audit (1 agent running); Live testing of all the above (auth first per owner); Google bleed + DNA-A/B fixes before the A/B test.
