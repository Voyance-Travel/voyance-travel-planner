## NEW.2 — Bar/nightcap cap widened to café-style venues

Single-line regex widen so the bar-price cap fires on café/aperitivo/digestif/pre-post-dinner stops that act as nightcaps without using the literal word "nightcap" (e.g. "Gran Caffè Quadri" nightcap pattern).

### Change

`supabase/functions/generate-itinerary/sanitization.ts:794`

Replace:

```ts
export const BAR_KEYWORDS = /\b(nightcap|cocktail|aperitif|drinks?\s+at|wine\s+bar|rooftop\s+bar|hotel\s+bar|speakeasy)\b/i;
```

With:

```ts
export const BAR_KEYWORDS = /\b(nightcap|cocktail|aperitif|aperitivo|digestif|drinks?\s+at|drinks?\s+only|after\s+dinner|wine\s+bar|rooftop\s+bar|hotel\s+bar|speakeasy|caff[eè]|caf[eé]\s+stop|pre[\s-]?dinner|post[\s-]?dinner)\b/i;
```

### Blast radius

`BAR_KEYWORDS` (from `sanitization.ts`) is consumed in exactly two cap paths, both of which already pair with `EXPLICIT_DRINKS_RE` exemptions and `MAX_BAR_PRICE` ceiling — so the widened set just enrolls more rows into the existing safe cap, no new behavior:
- `sanitization.ts:818` — generation-time bar cap.
- `action-repair-costs.ts:439` — repair-costs cap parity (mem://constraints/itinerary/repair-costs-bar-cap-parity).

Unaffected: `generation-core.ts:2503` defines its own local `BAR_KEYWORDS` const for a different category-coercion path; not an export consumer.

### Edge-case notes

- `caff[eè]` matches "caffè" / "caffe" / "caffé"; full-meal venues with "caffè" in the name (e.g. "Caffè Florian breakfast at 09:00") are still bypassed by the existing breakfast/lunch/full-meal heuristics in the cap path (the cap only fires for drinks-only/late-evening shapes already gated upstream).
- `caf[eé]\s+stop` is intentionally narrow — only matches phrasings like "café stop" / "cafe stop" so generic café visits aren't downgraded.
- `pre[\s-]?dinner` / `post[\s-]?dinner` covers "pre-dinner drinks" / "post dinner aperitivo" framings.

### Verification

```
grep -n "aperitivo\|digestif\|caff\[e" supabase/functions/generate-itinerary/sanitization.ts
```
Expect the new regex line.

Optional smoke: a synthetic activity `{title: "Nightcap at Gran Caffè Quadri", price: 206}` should now be capped to `MAX_BAR_PRICE` by both `sanitization.ts` and `action-repair-costs.ts` paths.

### Files touched

- `supabase/functions/generate-itinerary/sanitization.ts` — one-line regex change.
