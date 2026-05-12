## What's actually broken

I pulled the persisted JSON for **The Dempsey Cookhouse & Bar** (the card in your screenshot):

> `description` = *"Request a table on the verandah for a beautiful view of the…"* — 114 characters, fully populated by the generator.

The data is fine. **The UI is refusing to render it.**

In `src/components/itinerary/EditorialItinerary.tsx`, two of the three card-render branches gate the description on `!compact`:

```tsx
// line 11608 (compact list card)
return d && !compact ? (<p>{d}</p>) : null;

// line 12004 (mobile / sm condensed card — also used at the breakpoint
// where your Dempsey screenshot is rendered)
return d && !compact ? (<p>...">{d}</p>) : null;
```

Only the fully expanded desktop branch (~line 11444) renders the description unconditionally. Every other card view drops it on the floor — including the one you've been staring at across Singapore, Hong Kong, Mallorca, Milan, and Bruges. **Every "the descriptions are missing" complaint we've chased into the backend has been a frontend rendering bug.**

That also explains why the persist net + Gemini description-fill + validation gate I added across the last several sessions never moved the needle — they were correctly populating data the UI never displayed.

## Fix

Single file, two edits, frontend only. No business logic touched.

1. **Remove the `!compact` gate from both dining-description render sites** in `src/components/itinerary/EditorialItinerary.tsx`:
   - line ~11608: change `d && !compact` → `d`
   - line ~12004: same

2. **Keep `line-clamp-2`** on the compact branch (line 12006) so the description stays visually contained — one or two lines, not a wall of text. Compact mode keeps its tight footprint; the description just stops being invisible.

3. **Don't widen the gate to non-dining cards.** `resolveActivityDisplayDescription` already returns `''` for non-dining cards that lack a real description, so removing `!compact` only un-hides text that exists. No new render risk for activity / transport / accommodation cards.

## Why I'm confident this is it

- Database verified: Dempsey card's `description` field is 114 chars of real copy.
- Singapore trip (post-fix generation): every dining card has a description in DB (62–121 chars).
- Hong Kong Day 3 dining cards with empty descriptions are a **separate, real** bug (chain truncation from the proof-of-charge gate before today's fix) — but unrelated to what you're seeing on Singapore right now.
- The compact gate has been there since the dining-description render was introduced, so this affects **every dining card on every trip** in the compact / list view, which exactly matches your "we never describe restaurants" symptom.

## Out of scope (deliberately)

- Hong Kong Day 3's empty descriptions — that trip predates the gate fix; once we surface descriptions in the UI, those rows will visibly look empty and you'll see the real backend gap. We can chase that next as a separate, much smaller fix.
- The duplicate hotel-return card — needs separate reproduction; deferring to its own pass.
- No backend, no prompt, no migration, no cost work.

## Verify

1. Apply the two-line edit.
2. Hard refresh Singapore trip — every dining card (Dempsey Cookhouse, Candlenut, Wild Honey, Violet Oon, Cut, Chye Seng Huat, Botanico, Waku Ghin, Symmetry) should now render its blurb.
3. Hard refresh Hong Kong trip — most dining cards will show their real descriptions; **Maison Eric Kayser** and **Ho Lee Fook** on Day 3 will visibly show no description (they're empty in DB), confirming where the actual backend leak is.
