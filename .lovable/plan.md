## TG2 — Route mismatch in publish copy-link

**Audit claim is wrong, but there's still a small action to take.**

`src/pages/TravelGuideEditor.tsx:183` builds `${getAppUrl()}/guide/${guide.slug}`. `src/App.tsx:258` actually defines `<Route path="/guide/:slug" element={<PublicTravelGuide />} />` — so the link works today and renders from the `travel_guides` table.

The relevant question after TG1 (which now mirrors AI guides into `community_guides` and exposes them at `/community-guide/:slug`) is: which surface should the "Copy public link" button point at?

Recommendation: **keep `/guide/:slug`** (no change to TG2). Reasons:
- The route exists and works.
- `PublicTravelGuide` is the renderer purpose-built for `travel_guides` rows; `CommunityGuidePublic` is the markdown-fallback view we just added for the mirror.
- Switching now would silently re-route every existing share link.

Optional follow-up (not part of this plan unless you want it): once the community surface is the canonical one, flip the copy-link target to `/community-guide/${guide.slug}` and add a redirect from `/guide/:slug` → `/community-guide/:slug`.

**Action:** none. Mark TG2 as resolved-by-investigation (audit had stale route info).

---

## Price Alerts — Path B (remove the toggle)

Confirmed in code:
- `src/pages/Settings.tsx:71` state, `:194` handler, `:485` UI.
- DB column `profiles.price_alerts` is read at `:111` and written via `savePreference('price_alerts', …)`.
- No `pg_cron.schedule` calls `send-price-alerts` anywhere (verified).

**Plan:**

1. `src/pages/Settings.tsx` — remove the price-alerts UI block only:
   - Delete the `priceAlerts` `useState` (line 71).
   - Delete `handlePriceAlerts` (lines 194–197).
   - Delete the JSX block (the `<div>…<Switch id="price-alerts" />…</div>` and the `<Separator />` immediately above it) around lines 478–489.
   - Remove `price_alerts` from the `.select(...)` projection on line 111 and the `setPriceAlerts(...)` line at 131.

2. **Do not** drop the `profiles.price_alerts` column. Keep existing user opt-ins intact so we can re-expose the toggle once the cron is wired. No migration in this plan.

3. **Do not** delete the `send-price-alerts` edge function. Leaving it dormant costs nothing and preserves the implementation for when scheduling is ready.

Out of scope: scheduling the cron (Path A), tooltip-disable styling (Path C), backfilling/clearing existing `price_alerts` values, and any change to the function code.

**Files touched:** `src/pages/Settings.tsx` only.