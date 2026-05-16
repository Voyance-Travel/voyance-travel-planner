## Diagnosis

The screenshot is from **travelwithvoyance.com** (the published site), not the preview. Two signals confirm the published bundle is stale:

1. **Toggle order**: screenshot renders `CNY ↔ USD`, but the current code in `EditorialItinerary.tsx` (line 6229) renders `USD ↔ {localCurrency}`. The published build pre-dates the order change.
2. **Default**: `useState<boolean>(false)` for `showLocalCurrency` (line 2800) + the cleanup `useEffect` that purges any legacy `voyance.currencyToggle.*` localStorage key (lines 2801–2812) are both already present in source.

So in the preview (and in any new publish), the header **will** start on USD. The custom-domain bundle just hasn't been redeployed since the fix landed.

## Plan

### Step 1 — Republish

Click **Publish** so the latest bundle (with the USD default + localStorage purge) ships to `travelwithvoyance.com`. After a hard refresh, the Trip Total header should read `$X,XXX` with the toggle showing `USD ↔ CNY` (USD highlighted).

### Step 2 — Verify after publish

Open `travelwithvoyance.com/trip/d1535be4-...` in a fresh tab (or hard refresh with cache disabled). Expected:
- Trip Total renders with `$` symbol on first paint.
- Toggle shows `USD ↔ CNY` with USD as the primary-colored span.
- Clicking the toggle flips to `CN¥…` for the session; a refresh returns to USD.

### Step 3 — (Optional safety net, only if needed)

If after republish + hard refresh the header still starts on local currency for some users, the most likely cause is a third-party script or service-worker cache. We would then:
- Add a `?v=` query bust to the entry chunk, **or**
- Move the localStorage purge from `useEffect` to module-init so it runs before first paint (currently runs after first paint, which is fine because state already starts `false`).

No code edit needed yet — Step 1 alone should resolve it.

## Files involved (reference only, no edits planned)

- `src/components/itinerary/EditorialItinerary.tsx` lines 2798–2812 (default state + localStorage purge)
- `src/components/itinerary/EditorialItinerary.tsx` lines 6220–6238 (toggle UI)
