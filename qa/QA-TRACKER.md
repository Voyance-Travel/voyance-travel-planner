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

# TABLE A — Pages × Features
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
| Admin — access control (only founders see it) | ⬜ | ⬜ | | | ⬜ |

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

## B4. Credits / charging
| Aspect | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Cost display == backend charge | ⏳ | ⬜ | audit running | | ⬜ |
| Server-side enforcement (can't gen w/o credits) | ⏳ | ⬜ | audit running | | ⬜ |
| Charge timing + refund-on-failure + double-charge | ⏳ | ⬜ | audit running | | ⬜ |
| Packages/bonuses math; bonus re-claim guard | ⏳ | ⬜ | audit running | | ⬜ |
| No cost/margin leak to non-admin | ⏳ | ⬜ | audit running | | ⬜ |

## B5. Cost / Google budget
| Aspect | Audit | Live | What went wrong | Resolution | Fix verified |
|---|:--:|:--:|---|---|---|
| Full call-site inventory + per-trip count | ⏳ | ⬜ | audit running (~$5/trip suspected) | | ⬜ |
| Global daily ceiling (~200/day) / circuit breaker | ✅ | ⬜ | **NONE exists** (Concern C-COST-2) | design in Google audit | ⬜ |
| Shared place-level cache, 1–2mo+ TTL, across users | ⏳ | ⬜ | per-trip re-pulls suspected | | ⬜ |
| Frontend per-keystroke autocomplete (client key, untracked) | ✅ | ⬜ | suspected bleed (C-COST-4) | | ⬜ |

---

# TABLE C — Concerns / Findings (open defects)
*Every defect carries its own two checkboxes + resolution + verify.*

| ID | Sev | Area | What went wrong | Audit | Live | Resolution | Fix verified |
|---|---|---|---|:--:|:--:|---|:--:|
| C-DNA-1 | HIGH | DNA accuracy | Maximal foodie quiz → "Urban Nomad" (generalist out-scores specialist) | ✅ | ❌ | fix #2 PR #24 (food 26→38 + urban anti-food guard; 192/192) | ⏳ deploy+re-quiz |
| C-DNA-2 | HIGH | DNA defs | Client gate `food_focus≥0.75` (hard) vs edge `0.4` (soft) — preview can disagree w/ result | ✅ | ⬜ | **pick ONE source of truth** — not done | ⬜ |
| C-DNA-3 | HIGH | DNA traits | Culinary answers leak to cultural_depth/ethics not food_focus (36 vs 16) | ✅ | ⬜ | rebalance answer→trait weights — partial only | ⬜ |
| C-DNA-4 | MED | DNA diff | Differentiation flatteners: "30–40% trait moderation" + generic fallback archetype | ✅ | ⬜ | verify in A/B + de-flatten | ⬜ |
| C-DNA-5 | HIGH | preferences | `profile.interests`/`dietary` computed but **never injected into compile-prompt** | ✅ | ⬜ | inject prefs into generation — not done | ⬜ |
| C-DNA-6 | LOW | latent | `signatureAnswers` no-op in V3 quiz path (legacy IDs); flat penalty ignores distance | ✅ | ➖ | follow-up | ⬜ |
| C-COST-1 | HIGH | cost | Admin dashboard read ~2× low on Google | ✅ | ⬜ | PR #21 | ⏳ live verify |
| C-COST-2 | CRIT | cost | **No global daily Google ceiling / circuit breaker** | ✅ | ⬜ | design in Google audit → implement | ⬜ |
| C-COST-3 | HIGH | cost | Full-gen venue-verify bypasses Places cache (uncached/activity) | ✅ | ⬜ | route through shared cache | ⬜ |
| C-COST-4 | HIGH | cost | Frontend address autocomplete per-keystroke, untracked, client key | ✅ | ⬜ | debounce + cache + track (or server proxy) | ⬜ |
| C-COST-5 | MED | cost | geocoding/routes/distance-matrix uncached | ✅ | ⬜ | cache | ⬜ |
| C-UX-1 | MED | quiz UX | Next not gated on all answers; Complete silently disabled w/ no guidance | ⬜ | ✅ | re-verify in code + fix | ⬜ |
| C-UX-2 | LOW | quiz UX | Result-card match% blank on new archetype | ⬜ | ✅ | re-verify in code + fix | ⬜ |
| C-REL-1 | MED | reliability | Client self-heal retry storm on permanently-failed trip (100s of identical fetch errors) | ⬜ | ✅ | bound retries / backoff | ⬜ |
| C-FRIEND-1 | HIGH | friends | "Sent" badge 3, only 1 invite renders; stuck Pending | ⬜ | ✅ | root-cause count/list mismatch in code | ⬜ |
| C-SHARE-1 | CRIT | share | Public-link 404 (gen_random_bytes/search_path) | ✅ | ✅ | DB ALTER + durable migration PR #25 | ✅ **CLOSED** |

---

# Rollup
- **Closed (both ✅):** original 5 generation bugs, CI green, Share public-link, core-page render + navigation links.
- **Awaiting verify (fix shipped):** DNA accuracy (PR #24 — deploy+re-quiz), admin cost dashboard (PR #21 — live open).
- **In progress (audit running):** pricing/credits, Google cost-bleed.
- **Untouched zones:** Auth/security, admin pages (beyond cost), trip-creation modes, in-itinerary tools, DNA→itinerary A/B, free-text & preferences DNA paths, most in-page functionality on marketing pages, Explore DNA-type pages.
- **Biggest open risk to owner goals:** C-COST-2/3/4 (Google bleed), C-DNA-5 (preferences ignored), C-DNA-1/2/3 (accuracy) — all must land before the A/B test is meaningful or affordable.
