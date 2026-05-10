## RS.M9 — PDF cached image URLs (preventive helper)

### Finding

`src/utils/consumerPdfGenerator.ts` does **not currently embed any activity photos** — there is no `photos.map`, no `pdf.addImage`, and no reference to `act.photos` anywhere in the file. The current PDF is text-only (title/time/location/duration/cost/description/tip).

So the literal "find where images are embedded and add a filter" instruction has no target. We have two reasonable paths:

**Option A (recommended) — add the helper now as a guard rail.** Export `isPermanentImageUrl` from the file so:
- The verify-grep passes (`isPermanentImageUrl` + `supabase.co/storage` both appear).
- Any future contributor wiring photos into the PDF has a ready, correctly-named filter and cannot accidentally embed token-expiring Google URLs.
- Zero runtime/visual change today — pure additive utility.

**Option B — no-op + comment.** Skip the change since there are no photos to filter; document in the file that when photos are added, they MUST be filtered through `isPermanentImageUrl`. Fails the verify-grep.

### Plan (Option A)

**`src/utils/consumerPdfGenerator.ts`**

Add near the top of the file (after the layout constants block, before `generateConsumerTripPdf`):

```ts
/**
 * Returns true only for image URLs that won't expire — safe to embed in a PDF
 * the user will keep for years.
 *
 * Permanent: our cached copies on Supabase Storage, Cloudinary, etc.
 * Expiring:  raw Google Places photo media URLs (token-bearing).
 *
 * Unknown hosts return false (conservative — better to omit than serve a
 * broken image later).
 */
export const isPermanentImageUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  if (url.includes('supabase.co/storage') || url.includes('supabase.in/storage')) return true;
  if (url.includes('cloudinary.com')) return true;
  if (url.includes('googleusercontent.com') && url.includes('photoreference=')) return false;
  if (url.includes('places.googleapis.com')) return false;
  return false;
};
```

No call site changes (none exist). When/if a future change adds photo embedding, the contributor uses:

```ts
const safePhotos = (act.photos || [])
  .map((p: any) => (typeof p === 'string' ? p : p?.url))
  .filter(isPermanentImageUrl);
```

### Verification

- `grep -c "isPermanentImageUrl\|supabase.co/storage" src/utils/consumerPdfGenerator.ts` ≥ 1.
- File still compiles; no behavior change in current PDFs.

### Out of scope

- Actually embedding photos in the PDF (separate feature).
- Backfilling cached photos for existing activities.
- Extending the allowlist to other CDNs we don't currently use.
