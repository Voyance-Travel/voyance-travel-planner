## What's actually wrong

Google Places **is** working — the bug is one tier above it. Your Monaco trip card is showing the famous Unsplash "airplane wing over clouds" photo (`photo-1500835556837-99ac94a94552`) because the **canonical destinations table** has it set as Monaco's `hero_image_url`.

It's not just Monaco — **2,009 destinations** share that exact same plane photo as their canonical hero (Sorrento, Boston, Maldives, Las Vegas, Auckland, Lagos, Cartagena, Tunis, St. Lucia, etc.). Another ~5 photos are duplicated across 15–26 destinations each (~2,100 rows total are poisoned).

### Root cause

The 2026-05-14 migration `Destination Canonical Stock Fallback` (memory) backfilled `stock_image_url → hero_image_url` for 2,219 rows to fix the Copenhagen/Dublin "blank gradient" bug. It assumed `stock_image_url` was per-destination. It wasn't — for ~90% of destinations the legacy `stock_image_url` was a single generic travel placeholder (the airplane). So a fix for "no hero" became "wrong hero" at scale.

The resolver chain runs: seeded → **canonical (poisoned)** → storage map → curated → DB curated → Google Places → gradient. It stops at canonical and never reaches Google.

## Fix

Two-part, both backend-only — no UI or resolver code changes.

### 1. Database migration: null the poisoned canonical heroes

For any `destinations` row whose `hero_image_url` (or `stock_image_url`) is shared by ≥2 other destinations, null both columns. That's the mass-duplication signal — a real Monaco hero is unique to Monaco.

```sql
WITH dups AS (
  SELECT hero_image_url
  FROM destinations
  WHERE hero_image_url IS NOT NULL
  GROUP BY hero_image_url
  HAVING COUNT(*) >= 2
)
UPDATE destinations d
SET hero_image_url = NULL,
    stock_image_url = CASE WHEN stock_image_url = d.hero_image_url THEN NULL ELSE stock_image_url END
FROM dups
WHERE d.hero_image_url = dups.hero_image_url;
```

Same pass for `stock_image_url` standalone duplicates. Also blacklist the same URLs in `curated_images` so they can't sneak back in.

Expected impact: ~2,100 destinations re-enter the resolver chain. They'll resolve via Google Places (already working — the Monaco edge logs show successful Places v1 calls for venues right now) on first view, then persist a unique URL via the existing write-back in `useTripHeroImage` (lines 296–335).

### 2. Memory + guard

- Update `mem://constraints/visual/destination-canonical-stock-fallback` to record the regression: backfill is forbidden when the source column has cross-destination duplicates.
- Add a one-line uniqueness check in the next migration: any future bulk `hero_image_url` write must reject if the same URL would land on ≥2 cities.

## What this does NOT change

- No edge function code changes (Google Places call is already correct).
- No frontend resolver changes (`useTripHeroImage`, `heroUrlPolicy`, `DestinationHeroImage`).
- No new image fetches up front — Google Places fires lazily on first view, same as today.
- The trip's stored `metadata.hero_image` for Monaco (currently empty) will be filled by the existing write-back once the fresh image resolves.

## Verification after apply

- Monaco trip card on `/` shows a Monaco photo (Google Places result), not a plane.
- `SELECT COUNT(*) FROM destinations WHERE hero_image_url = '…1500835556837…'` returns `0`.
- Spot-check 5 of the previously-poisoned cities (Boston, Maldives, Sorrento, Auckland, Cartagena) — each gets a distinct hero.
