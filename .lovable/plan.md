## Root cause

"Gran Caffè Quadri nightcap" inherits a Michelin 1-star floor (€120+) and the AI seeds it at the same €206/pp as the Da Ivo dinner because:

1. `enforceBarNightcapPriceCap` (sanitization.ts:790) detects "nightcap" → would cap at €35, **but** it then loops over `KNOWN_FINE_DINING_STARS` and finds `'quadri'` → returns false (no cap applied). The exemption was designed to protect the Michelin restaurant Quadri, but it also exempts the café/bar at the same address.
2. `enforceMichelinPriceFloor` doesn't actively raise it (price already high), but if it did, "Gran Caffè Quadri" + "nightcap" would still be matched as Quadri/1-star and floored at €120.
3. Net effect: the nightcap card carries restaurant-grade pricing.

## Fix (sanitization only — no schema changes)

### A. `enforceBarNightcapPriceCap` — narrow the Michelin exemption

The exemption should only apply when the activity is genuinely a meal at a Michelin-starred restaurant, not when the title/description explicitly frames the visit as drinks/nightcap/aperitif/cocktails.

- Define `EXPLICIT_DRINKS_RE = /\b(nightcap|cocktails?|aperitif|aperitivo|digestif|drinks?\s+at|wine\s+bar|after[-\s]?dinner\s+drinks?|caffè|caffe|café|cafe)\b/i` for the disqualifying signal.
- If the title matches `EXPLICIT_DRINKS_RE`, **skip** the `KNOWN_FINE_DINING_STARS` exemption and apply the bar cap (€35 default, €55 ceiling) regardless.
- Keep the existing exemption for ambiguous "bar" matches (e.g., "Bar at Quadri Restaurant" where the dinner intent is real).

### B. `enforceMichelinPriceFloor` — add a drinks/nightcap skip

At the top of the function (after the `KNOWN_CASUAL_VENUES` guard), add:

```ts
if (EXPLICIT_DRINKS_RE.test(title) && !/\b(dinner|lunch|tasting\s+menu|chef'?s\s+table)\b/i.test(title)) {
  console.log(`MICHELIN FLOOR SKIP [${logPrefix}]: "${activity.title}" reads as drinks/nightcap, not a meal — skipping fine-dining floor`);
  return false;
}
```

This prevents the Michelin floor (and the luxury-hotel-dining heuristic at line 578) from re-inflating a nightcap that names a Michelin-starred venue or top-tier hotel.

### C. Order of operations

`enforceBarNightcapPriceCap` already runs in `universal-quality-pass.ts:262` and inside `action-generate-trip-day.ts`. After fix A, it will overwrite the AI-supplied €206 with €35 before the Michelin floor sees it. Fix B is the belt-and-suspenders so the floor never re-raises it.

### D. Sentinel + memory

- Add a log tag `[BAR_CAP_DRINKS_OVERRIDE]` when the Michelin exemption is bypassed due to explicit drinks language.
- Add memory: `mem://constraints/itinerary/nightcap-michelin-exemption-bypass` documenting that explicit drinks/nightcap/café framing disqualifies the Michelin exemption in the bar cap.

## Files touched

- `supabase/functions/generate-itinerary/sanitization.ts` (fixes A + B, share `EXPLICIT_DRINKS_RE` constant)
- `supabase/functions/generate-itinerary/__tests__/` — add unit test: "Gran Caffè Quadri nightcap" at €206 → capped to €35; "Dinner at Ristorante Quadri" at €80 → floored to €120 (regression guard).
- `mem://constraints/itinerary/nightcap-michelin-exemption-bypass.md` + index update.

No DB migration. No frontend changes. No prompt changes (cap is post-gen).