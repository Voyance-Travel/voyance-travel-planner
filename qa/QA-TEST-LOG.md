# Voyance Travel — Full-Site QA Test Log

Living record of the top-to-bottom QA pass. Updated continuously as testing proceeds.
Env: **prod** (travelwithvoyance.com). Test credits authorized. Account: ashtonlaurenn@gmail.com.

Legend: ✅ pass · ⚠️ issue (minor) · ❌ fail (broken) · 🔎 needs recheck · ⏳ in progress

---

## 0. Status board
| Area | Code audit | Live testing | Fixes |
|---|---|---|---|
| Admin cost dashboard | ✅ done | ⏳ | ✅ accuracy fix landed (pricing/place-details/retries) |
| Google savings (ceiling + perma-cache) | ✅ done | — | ⏳ pending |
| Quiz → DNA assignment | ⏳ audit running | ⏳ starting | — |
| DNA → itinerary differentiation | ✅ done | ⏳ | — |
| Auth / login + security | ⏳ audit running | — | — |
| Navigation / dead ends / UX | ⏳ audit running | ⏳ | — |
| Pricing / credits / leaks | ⏳ audit running | — | — |

---

## 1. Quiz → Travel DNA accuracy
Goal: take the quiz with deliberate answer patterns and verify the **assigned DNA archetype matches what the answers should produce** (accuracy = integrity). Then confirm each DNA drives a **different** itinerary.

Known risk (from logs): DNA can resolve to *fallback archetype / trait_scores all zeros* → generic results.

### Baseline (current account DNA, before retake)
- Account: Ashton Lightfoot (ashtonlaurenn@gmail.com). DNA shown on /profile: **"The Story Seeker"** — type CONNECTOR · Uncommon · **31% match** · hints of "The Rediscovery Traveler".
- 31% match is **low** (weak/ambiguous fit). DNA stored in `travel_dna_profiles` (col `primary_archetype_name`). Quiz completion recorded ("DNA Discovered" milestone). The profile "Update Travel DNA" button recomputes DNA from the granular Preferences form (separate from the /quiz narrative).
- Two DNA input paths: (1) `/quiz` structured 10-step quiz, (2) "Just Tell Us Your Story" free-text (parse-travel-story), (3) Preferences-form "Update Travel DNA".

### Quiz runs
| # | Answer pattern (intent) | Expected archetype | **Assigned (actual)** | Verdict |
|---|---|---|---|---|
| Q1 | **Strong CULINARY** — ~10 of ~22 answers food-coded: best-breakfast, four-nice-dinners, "Food. Every meal researched", "eat/drink things I can't get at home", "perfect unhurried meal", "exclusive tables", "local restaurants over chains", "wonder what locals eat". (Secondary: cities/cafés ×3, intimate ×3, established/luxury.) | Culinary archetype (e.g. Culinary Cartographer) | **"The Urban Nomad"** (EXPLORER · Uncommon · hints of "The Rediscovery Traveler"). Superpowers: metro/neighborhoods/dive-bars. Tags: Authentic, Luxury. **Food absent.** | ⚠️ **ACCURACY MISS** |

### FINDINGS — quiz
- ✅ **Quiz DOES complete + persist.** (My earlier "dead-end" was MY error — I skipped the **LIFE STAGE** question at the TOP of step 10; step 10 has 5 questions, I'd answered 4. Once answered, Complete enabled, saved, and the profile DNA updated "Story Seeker" → "Urban Nomad". NOT a product bug.)
- ⚠️ **[HIGH] DNA accuracy miss:** the dominant signal in the answers (FOOD, ~half of all answers) is **not reflected** in the assigned archetype. A heavily-culinary quiz returned an **urban/explorer** archetype ("Urban Nomad") with zero food/culinary in the title, narrative, superpowers, or tags. Either trait-scoring under-weights the food-coded answers, the archetype→mapping ignores a high "culinary" trait, or there's no reachable culinary archetype for this answer mix. → Directly threatens "DNA aligns with what it should give" and feeds the "generic/mismatched itinerary" concern (a mis-typed foodie won't get a food-forward trip). **CROSS-REF with quiz→DNA + differentiation audits.**
- ⚠️ **[LOW] Match % missing on result card:** old "Story Seeker" showed "31% match"; the new "Urban Nomad" result card shows "Your match ·" with **no value**. Possible display bug (or a 0/low match). Verify.
- ⚠️ **[MED] UX:** `Next` is NOT gated on answering every question on a step, and "Complete" silently disables at <100% with **no indication of which question is unanswered** (no scroll-to/highlight/message). This is exactly how I (and a real user) can skip a top-of-step question and get stuck with no guidance. Worth a fix even though completion is possible.
- ⚠️ **[MED] UX:** step transitions re-display the prior step's answered questions (faded) and stack history, forcing a long scroll to each new question pair (and making it easy to skip the top question of a step).
- ✅ Positive: quiz content is strong (scenario-based; per-answer "trait reveal" captions work and correctly food-coded).

### DB round-trip checks
- [x] Quiz completes + persists; profile DNA updated to "Urban Nomad" ✅
- [ ] Inspect raw trait_scores in travel_dna_profiles (couldn't — not exposed in profile UI/fiber; needs DB row)
- [ ] Determinism: same answers → same DNA

### 🔬 ROOT CAUSE (code audit of the DNA-accuracy miss) — Audit ✅
Flow: quiz answers → `calculateTraitScores` (V3 25-trait, 0-1; weighted-max max*0.7+avg*0.3) → V2 8-trait + fine-grained V3 sent to edge `calculate-travel-dna` → archetype picked there.

1. **[HIGH] Two divergent archetype-definition systems that disagree:**
   - CLIENT `src/config/quiz-questions-v3.json` (+ `archetype-matcher.ts`): `culinary_cartographer.required = { food_focus: {min: 0.75} }` — a **HARD GATE** (miss → score `-Infinity`, disqualified).
   - EDGE `supabase/functions/calculate-travel-dna/index.ts:513`: same archetype `fineGrained: food_focus min **0.4** weight 20` — **soft/weighted**, far more lenient.
   - → client preview and server result can DISAGREE; and the 0.75 client gate is so high a strong foodie can be hard-disqualified client-side. Pick ONE source of truth.

2. **[HIGH] Culinary intent leaks to `cultural_depth`/`ethics`, not `food_focus`:**
   - `"Wonder what the locals eat"` → cultural_depth 0.8 / food_focus 0.5 (more cultural than food).
   - `"local restaurants over chains"` → cultural_depth 0.5 + ethics 0.5, **food_focus 0**.
   - `cultural_depth` is referenced in **36** answers vs `food_focus` in **16** → a foodie's signal is split/diluted away from the trait the culinary archetype keys on. So food_focus may land below the threshold even for an obvious foodie.

3. **[MED] Single-dominant-dimension personas are fragile:** culinary keys on ONE trait (food_focus) behind a gate; `urban_nomad` keys on FOUR easier partial criteria (nature≤0.3, novelty≥0.65, social_energy≥0.55, flex≥0.6) whose partial matches accumulate. A foodie who also likes cities (my answers: "cities are my wilderness", cafés, novelty) gets pulled into the broad EXPLORER archetype. NOTE: my answers were intimate/low-social — yet urban (which wants social_energy≥0.55) still won → scoring lets unmet criteria pass without disqualifying (edge fineGrained are soft).

**To finish-confirm:** read `travel_dna_profiles.trait_scores` for this submission — is food_focus high (→ scoring/mapping bug) or did it land low (→ trait-leak/threshold bug)? Both fixes are warranted regardless. Cross-ref with the quiz→DNA background audit when it lands.

### 🐞 Other (observed in console during quiz, from a prior trip 217e0d64)
- **⚠️ [MED] Self-heal retry storm:** the console showed a tight repeating loop of `[safeUpdateItineraryData] backend save failed: FunctionsFetchError` + `CHRONOLOGY_BLOCKED`/`PREDAWN_CASCADE` on an old failed trip — hundreds of repeated identical log cycles (10k console msgs). Looks like an unbounded client self-heal retry loop on a permanently-failed trip. Revisit.

---

## 2. DNA → itinerary differentiation (A/B)
Hold constant: same city (Madrid), dates, 1 traveler, no must-dos. Vary archetype only.
| Run | Archetype | dining ratio | venue mix | distinct venues vs others | archetypeSource=fallback? | Verdict |
|---|---|---|---|---|---|---|
| A | culinary | | | | | |
| B | cultural | | | | | |
| C | adventure | | | | | |
| D | culinary + dietary/prefs variation | | | | | |

Pass bar: ≥40% named venues differ (culinary vs cultural), dining-ratio delta ≥15pts, category mix archetype-aligned, NO fallback in logs.

---

## 3. Navigation / dead ends / UX
Extracted all 22 nav+footer links via DOM — **all have real hrefs, zero `#`/empty dead links.** Routes: /how-it-works /pricing /about /careers /press /destinations /guides /quiz /travel-tips /help /contact /faq /privacy /terms /start /profile/edit.
| Route / link | Result | Verdict |
|---|---|---|
| /destinations | "Build Your Paris Itinerary" hero + Featured Destinations | ✅ renders |
| /guides | Guides/Community/Founder's tabs + category filters + cards | ✅ renders |
| /careers | "Join Our Journey" + Open Positions (4) | ✅ renders |
| /faq | FAQ categories + accordions | ✅ renders |
| /help /contact /press /travel-tips | not yet live-checked | ⬜ |
| **"Cookies" footer link → /privacy** | points to Privacy page, not a dedicated cookies policy | ⚠️ minor smell |

Verdict so far: **navigation healthy, no dead ends found.** (Live ✅ for the spot-checked routes; the rest are low-risk given the pattern.)

---

## 4. Pricing / credits
Account is **seeded with 1,933,385 purchased credits** (test/admin acct) → generations feel free here. "Purchased credits never expire."
- **Quick top-up:** 100cr/$9 ($0.090/cr), 300cr/$25 ($0.083/cr), 500cr/$39 ($0.078/cr).
- **Voyance Club:** Voyager $49.99→600cr ($0.083), Explorer $89.99→1,600cr ($0.056, "Popular"+priority support), Adventurer $149.99→3,200cr ($0.047, Founding badge first 1,000).
- **Earn Free Credits:** Welcome +150, Early Adopter +500, Quiz Complete +100, "travel pro" +50. "Available to Earn: 0" (bonuses appear one-time/claimed).
- 4-day trip = 240cr (60/day); day-unlocks "charged separately".

Verdict: per-credit pricing internally consistent (volume discount); healthy margin over ~$0.065 AI/trip (margin erodes if uncached Google balloons — see cost findings). **No pricing display errors found.**
NOT live-tested (would require exploiting the financial/credit system): re-claimable earn-bonuses (does re-quiz re-award +100?), server-side spend enforcement (charge before/after value?), double-charge on regen/heal, day-unlock without credits. → **defer to pricing code audit; verify in code, not by live exploit.** "Buy" = real Stripe checkout, not tested (financial action).

---

## 5. Auth / login
| Test | Result | Verdict |
|---|---|---|
| | | |

---

## 6. Follow-ups / go-back-and-check
- (running list of things to revisit)

---

## 7. MASTER CROSS-REFERENCE REGISTER
Methodology: each issue is verified in **two places** — the **code audit** (read the code) and **live testing** (exercise the site).
- **Audit** col: ✅ found in code · ⬜ not yet checked in code · ➖ n/a
- **Live** col: ✅ reproduced live · ⬜ not yet tested live · ➖ n/a
- **Both ✅ → CONFIRMED** (real, agreed). One ✅ only → **RE-VERIFY the other side** before acting. Both ➖/⬜ → open.

| # | Sev | Area | Issue | Audit | Live | Status | Fix |
|---|---|---|---|:--:|:--:|---|---|
| 1 | HIGH | cost | Admin cost dashboard reads ~2× low on Google (stale $0.017 price, missing Place-Details col, counts retries) | ✅ | ⬜ | re-verify live (open admin UnitEconomics, compare) | ✅ FIXED (useRealCostMetrics.ts) |
| 2 | CRIT | cost | No global daily Google-call ceiling / circuit breaker anywhere | ✅ | ⬜ | re-verify live | pending |
| 3 | HIGH | cost | Full-gen venue-verify bypasses the Places cache wrapper (uncached per-activity) | ✅ | ⬜ | re-verify live (cold-cache trip → count google calls) | pending |
| 4 | HIGH | cost | Frontend address autocomplete calls Google per-keystroke, untracked, client key | ✅ | ⬜ | re-verify live (DevTools network on address field) | pending |
| 5 | MED | cost | geocoding/routes/distance-matrix uncached | ✅ | ⬜ | | pending |
| 6 | HIGH | DNA | **Accuracy miss:** strong culinary quiz → "Urban Nomad" (urban) archetype, food absent | ✅ | ✅ | **CONFIRMED** (both sides) | open — see root cause §1 below |
| 6a | HIGH | DNA | Divergent culinary archetype defs: client gate food_focus≥0.75 (HARD) vs edge min 0.4 (soft) | ✅ | ➖ | confirmed in code | pick one source of truth |
| 6b | HIGH | DNA | Culinary answers leak to cultural_depth/ethics not food_focus (cultural_depth in 36 answers vs food_focus 16) | ✅ | ➖ | confirmed in code | rebalance answer→trait weights |
| 6c | MED | DNA | Edge fineGrained min/max are soft (don't disqualify) → broad multi-criteria archetypes (Urban Nomad) beat single-dominant ones (foodie) | ✅ | ✅ | confirmed | revisit gating |
| 7 | MED | DNA/UX | Quiz: Next not gated on all answers; Complete silently disabled <100% with no "which question" guidance | ⬜ | ✅ | re-verify in code | open |
| 8 | LOW | DNA/UX | Result card "Your match" % missing/blank on new archetype | ⬜ | ✅ | re-verify in code | open |
| 9 | MED | DNA | Differentiation flatteners: "30-40% trait moderation" rule + generic fallback archetype | ✅ | ⬜ | re-verify live (A/B itineraries) | open |
| 10 | MED | DNA | profile.interests/dietary computed but never injected into compile-prompt | ✅ | ⬜ | re-verify live | open |
| 11 | MED | reliability | Client self-heal retry storm on a permanently-failed trip (100s of identical FunctionsFetchError cycles) | ⬜ | ✅ | re-verify in code | open |
| 12 | **CRIT** | share | **"Sharing always broken"** — Public-link toggle → `rpc('toggle_consumer_trip_share')` returns **404**. Real root cause: body calls `gen_random_bytes()` (in `extensions` schema) under `search_path=public` only → runtime "function does not exist" → PostgREST 404. | ✅ | ✅ | **CONFIRMED (both)** | ✅ **FIXED & VERIFIED LIVE** — DB patched (`ALTER … SET search_path=public,extensions`); toggle on/off + public URL load all 200; repo migration made durable (PR #25) |
| 13 | HIGH | friends | Friends "Sent" tab badge says **3** but only **1** invite renders (count/list mismatch); invite stuck "Pending" | ⬜ | ✅ | re-verify in code | open |

## 7b. DNA accuracy — LIVE RE-QUIZ (fix #1 FAILED, fix #2 applied)
- 🔴 **Fix #1 (PR #21/#22) INSUFFICIENT — confirmed live.** Re-took the full 22-question quiz with a *maximal* foodie lean (the food-forward option on every question that had one: "Food. Every meal is researched", "I want to eat and drink things I can't get at home", "Wonder what the locals eat", "four nice dinners", "perfect unhurried meal", "local restaurants over chains", "tables at restaurants", etc.). **Result: STILL "The Urban Nomad"** (hints of Romantic Curator) — NOT Culinary Cartographer.
- **Deeper root cause (deterministic, recomputed offline):** Urban Nomad is a multi-criteria *generalist* — banks 3 primaryTraits (incl. `social` sweetSpot=4 → +10 for a merely-moderately-social foodie; `comfort` +10) + 4 fineGrained bonuses (+10 just for low nature). Culinary Cartographer is a *specialist*: 1 primaryTrait + food_focus capped at ~+24.7 (weight 26). The generalist out-accumulates the specialist. Also: in the **V3 quiz path `signatureAnswers` never fire** — the arrays hold legacy IDs (`g3`), but V3 sends `q7a`-style IDs, so the foodie's signature edge is silently lost. Across a 192-cell food-dominant grid, Culinary won only **97/192**.
- ✅ **Fix #2 (applied, grid-validated 192/192):** in `calculate-travel-dna/index.ts` — (A) culinary_cartographer `food_focus` weight **26→38**; (B) added anti-food guard to urban_nomad `{ food_focus, max: 0.6, weight: 22 }` (it is NOT a food archetype — penalizes food-dominant profiles, mirroring art_aficionado's guard at line 541). Culinary now beats Urban by **+16–22** across the food-dominant band; no regression for true urban nomads (food≤0.6) or art_aficionado.
- ⚠️ Latent follow-ups flagged (separate): `signatureAnswers` no-op in V3 path (legacy IDs); flat `-(weight*0.75)` penalty ignores distance past `max`.
- ⏳ Needs edge deploy + live re-verify (re-quiz as foodie → expect Culinary Cartographer).

## 8. Share / Friends (live)
- ✅ Friend data layer works: Friends(2) Clinton Brooks + Layne Lightfoot render; Requests empty-state renders; "Trip Together blend" copy present.
- 🐞 **[CRIT] Public-link share BROKEN** — toggling "Public link" in Share dialog → toast **"Could not update sharing. Please try again."** Network: `POST /rest/v1/rpc/toggle_consumer_trip_share` → **404**. Root cause: the RPC (signature `(p_trip_id uuid, p_enabled boolean)`, matches the frontend call exactly) is defined in repo migrations + types.ts but **does not exist in the prod database** — the migration was never applied. **Fix:** `supabase/migrations/20260605120000_restore_toggle_consumer_trip_share.sql` re-asserts the function (CREATE OR REPLACE, idempotent) + `NOTIFY pgrst 'reload schema'`. ⚠️ Only fixes prod IF the deploy applies migrations; otherwise run the SQL in the Supabase SQL editor.
- 🐞 **[HIGH] Friends "Sent" count/list mismatch** — badge says 3, only 1 row renders ("Clinique Brooks — Pending"). Likely the "always broken" friend-invite symptom (invites stuck/under-rendering). Root-cause in code (separate from the RPC).
- Share dialog otherwise renders well: Public link / Copy / Share / WhatsApp / X, "Invite to collaborate" (email + generate link), "Friends get 150 bonus credits" promo.
- NOT tested (side-effectful, needs care/permission): actually sending a friend-invite email to a third party; the collaborator invite link.
