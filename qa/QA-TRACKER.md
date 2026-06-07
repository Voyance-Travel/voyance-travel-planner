# Voyance Travel — QA Tracker

**State document. What's working, what's open, what needs the owner.** Not a changelog.
An item is GREEN only when verified **live on the new stack** (code-read alone ≠ done).

**Env:** owned Supabase `qpwexpjqzsdkjkvgcntx` · OpenRouter AI · Vercel (`voyance-travel-planner.vercel.app`) = staging. `travelwithvoyance.com` stays on the old Lovable site (rollback) until cutover is QA-verified. Test credits authorized · Account: ashtonlaurenn@gmail.com.

---

## CURRENT STATE — 2026-06-07

| Track | State |
|---|---|
| 🚚 Migration & cutover | ✅ **DONE** — own Supabase + OpenRouter + Vercel; 48,831 content rows ported; schema/functions/secrets/realtime/Stripe/email all live |
| 🤖 Core trip generation | ✅ **WORKING — verified live end-to-end** (free first trip: 4 days / 63 real DNA-differentiated activities) |
| 🔓 Paid unlock (bulk + full-trip) | ✅ **WORKING — verified live** (−120 credits, days unlock, ledger correct) |
| 💬 Freemium copy | ✅ accurate ("first trip starts free — 2 days included") |
| 🔵 Product QA on new stack | **~15%** — foundational pages + the core money/build path verified; most in-itinerary tools & build modes still untested live |

### Verified live on the new stack
Images · Google OAuth login · public-share RPC · A1 Home · A2 Explore (search→destination) · A3 all marketing pages (pricing matches backend) · A4 quiz (gating + DNA assignment + match%) · A5 Profile (overview/credits/friends-sent/prefs) · A8 admin (gate + cost dashboard) · B4 credit grants (welcome 150 + quiz 100 + prefs 50 = 300, DB-confirmed) · **trip generation (free first trip)** · **paid day-unlock**.

### Recently fixed (this cutover) — all verified live unless noted
- **Trip-gen 403** (free-first-trip gate ignored `profiles.first_trip_used`) → gate honors the flag.
- **AI 401** — all 14 AI call sites used the old `Lovable-API-Key` header instead of `Authorization: Bearer` for OpenRouter → every LLM call was unauthenticated. Fixed across `generate-itinerary` (+pipeline/_shared), `activity-concierge`, `itinerary-chat`.
- **Paid unlock broken** — `useBulkUnlock` + `useUnlockTrip` didn't send the now-required `metadata.idempotencyKey` → 400. Fixed both.
- Site-wide images · OAuth/SPA callback · quiz gating · freemium wording (7 strings).

---

## NEEDS THE OWNER

- **pg_cron — 2 HTTP jobs** (`auto-summarize-completed-trips`, `send-trip-reminders-daily`) still point at the OLD project. Background-only (nightly), not user-blocking. Fix needs the service-role key set as a DB setting — blocked from automating (credential-leak guard). **Paste the 3-line SQL (provided in chat) into the Supabase SQL editor.**
- **Optional secrets** (enrichment quality only): Viator · Foursquare · TripAdvisor · Unsplash · APNS/IAP iOS keys.
- **Final cutover:** attach `travelwithvoyance.com` to Vercel once QA passes (old site = rollback until then).

---

## OPEN WORK — what's left to test/verify live

### Core build & itinerary (highest value)
- ⬜ **4 build modes** end-to-end: Single City · Multi-City · Just Tell Us (free-text) · Build Myself
- ⬜ **Build wizard** steps validate/persist/resume (dest, dates, party, interests, dietary, pace, budget, accommodation, must-dos, accessibility)
- ⬜ **In-itinerary tools** (each: works + persists on refresh + correct credit charge + refund-on-failure): regenerate day · swap activity · move/reorder · add activity · add flight/hotel · lock · Smart Finish · mystery · route optimize · restaurant recs · hotel optimize · AI chat · Export/PDF · Maps render · collaborator invite link
- ⬜ **Persistence integrity** — `itinerary_activities` table ↔ `trips.itinerary_data` JSON stay in sync after regen/swap/move (known historical divergence point)

### DNA & preferences (the big proof) — see test plan below
- ⬜ Same city, different DNA → measurably different itinerary (≥40% venues differ, dining-ratio Δ≥15pts, no generic fallback)
- ⬜ Preferences honored in output (dietary, budget tier, pace, accommodation, accessibility, must-dos/avoids)

### Auth & security
- ⬜ A9 finish: email signup · password reset · logout · email verification · return-path deep link
- ⬜ Table E security: RLS spot-check (trips/credits/dna/user_roles) · edge-fn auth gating · no secret leak in bundle · non-admin admin-route denial (needs a 2nd account)
- ⬜ User-type matrix: anon (gen blocked) · free (limits) · paid · club member

### Other live re-checks
- ⬜ A4 "Just Tell Us Your Story" free-text DNA path · A5 friends add/accept flow · A1 logged-out marketing embeds
- ⬜ Re-verify the original 5 generation fixes on a fresh build: launcher-timeout/heartbeat · crash-proof renderer · Partial-badge · meal coverage · departure transit
- ⬜ Admin: Revenue/Forecast/Projections sub-tabs

---

## KNOWN OPEN DEFECTS (still-open only; condensed)

Code carried over from pre-migration. These are genuinely **not yet fixed** (distinct from "fixed, awaiting live re-verify").

| ID | Sev | Area | Issue | Direction |
|---|---|---|---|---|
| C-COST-3b | HIGH | cost | Google **daily ceiling not proven enforcing** — `google_api_budget` never incremented in prod; verify the breaker actually counts on a real build | behavioral counter test on next trip-build |
| C-COST-4/5/6 | MED | cost | Uncached Google paths: frontend "Search with Google" (exposed key, untracked) · geocode/routes/distance-matrix · recommend-restaurants/hotels/reviews (engagement-scaled) | route via cached proxy wrappers |
| C-COST-7 | LOW | cost | SKU billed even on network/abort; retries can double-bill a venue | don't bill on abort; cache-before-retry |
| C-CRED-4/C-CRED-8 | HIGH | credits | Trip-gen cost is floor-only server-side (`days×60×0.9`) — client can skip multi-city fee + DNA complexity multiplier → undercharge | recompute canonical cost server-side from trip row |
| C-CRED-6 | MED | credits | Monthly free-grant check-then-act race → possible concurrent 2× 150cr | atomic conditional UPDATE / unique(user,month) |
| C-CRED-2b | LOW | credits | Guide-gen dup-click can double-charge (charge-after-success fixed the worst part) | client idempotencyKey on the guide charge |
| C-TOOL-1/2/3/4 | HIGH/MED | tools | Refund-on-failure missing on several paid tools (day-unlock 60, AI-chat modifier, hotel-opt 100, add-activity 5) → credits lost if apply throws/cancels | add REFUND in catch / charge-after-confirm |
| C-TOOL-5 | MED | tools | Charge/config drift: dead `RESTAURANT_REC` action consumes swap cap; chat pace/filter advertised-paid but free; chat prompt misquotes regen price | reconcile actions + prompt |
| C-TOOL-6 | MED | tools | AI-feature edge fns (recommend-restaurants/hotels/optimize/chat/mystery) auth'd but **not** credit-gated server-side — trust client to charge | server-side proof-of-charge like generate-itinerary |
| C-DNA-2/2b/3/5 | HIGH/MED | DNA | Trait-tuning gaps: client vs edge food-focus thresholds disagree · culinary answers leak to cultural traits · recalc path uses a divergent matcher · single-day regen with empty context drops dietary block | one source of truth for thresholds; rebalance answer→trait weights; route recalc through matchArchetypesV2 |
| C-DNA-4 | HIGH | DNA A/B | Differentiation was flattened ("30-40% archetype seasoning"); de-flatten fix shipped but **needs the live A/B proof** (culinary vs cultural must diverge) | run the DNA test plan |
| C-REFERRAL-1 | HIGH | growth | "Friends get 150 bonus credits" is non-functional — no referral bonus type, no `?ref=` consumption at signup | implement attribution + grant |
| C-PERSIST-3 | MED | itinerary | Lock toggle: table updates but JSON lock frozen-blocked → reverts on refresh | pass `saveReason:'lock-toggle'` |
| C-CREATE-1 | MED | create | "Just Tell Us" has no end≥start date guard → could create a zero/negative-day trip | add `isBefore(end,start)` check |
| C-SEC-1 | MED | security | `verify_jwt=false` default on ~all edge fns (compensated by self-verify; a future un-gated fn would be exposed) | flip to true for non-public fns |
| C-DATA-1 | MED | payments | IAP purchase path may not upsert `user_tiers` (Stripe webhook does) → IAP buyers untracked | verify on new stack; ensure upsert |
| /press copy | LOW | content | "By the Numbers" says 29 archetypes; feature list says 27 — internal inconsistency | copy fix |

> **Fixed-but-needs-live-reverify (not broken, just unproven on the new stack):** DNA accuracy (foodie→Culinary verified) · in-itinerary regenerate/edit persistence (C-PERSIST-1/2 saveReason fixes) · admin cost dashboard · credit-integrity hardening (Stripe priceId-derived grant, refund keying). These re-verify naturally as the build/tools tests above run.

---

## 🧬 TEST PLAN — DNA & Preference Adherence (the big proof)

Hold destination constant, vary DNA/preferences, confirm the output **measurably differs**. Closes the DNA/preferences/build-mode open items in one pass.

**DNA profiles (same city, different DNA → different itinerary):**
| Profile | Expect | Generated | Adheres |
|---|---|:--:|:--:|
| Culinary / foodie | markets, tapas crawl, cooking class, high dining ratio | ⬜ | ⬜ |
| Cultural / history | landmarks, museums, historic walks, low nightlife | ⬜ | ⬜ |
| Adventure / active | hikes, water sports, day-trips, active pacing | ⬜ | ⬜ |
| Relaxed / wellness | spa, beach, fewer activities/day, slow mornings | ⬜ | ⬜ |

**Preference adherence:** dietary=vegetarian (veg-friendly picks) · budget=budget vs luxury (price tier) · pace=relaxed (≤3/day) · accommodation=unique (boutique not chain) · accessibility=step-free.

**Pass/fail:** ≥40% venues differ between profiles · dining-ratio Δ≥15pts (culinary vs cultural) · no generic fallback (every day real named geolocated venues) · each generation charges correct credits via OpenRouter.

**Build modes** (each → complete itinerary, no fallback, DNA applied): Single City ⬜ · Multi-City ⬜ · Just Tell Us ⬜ · Build Myself ⬜.

> Note: one data point already exists — the Madrid free-first-trip (cultural_anthropologist DNA) correctly produced edge activities (e-bike, bouldering), authentic-neighborhood encounters (La Latina), and nightlife (Flamenco, Salmon Guru). The plan needs a **contrasting** profile to prove divergence.

---

## Reference — already closed (one line)
Original 5 generation bugs · CI green · public-share link · core-page render + navigation · auth/security audit (strong) · admin authz · creation-mode code audit · marketing functionality · collaboration · preferences→prompt injection · the 6 SQL deep-dive bugs (cost dashboard, My Trips, credit FK, user_tiers IAP, poller runaway) — all fixed; spot-check as the live tests above exercise them.
