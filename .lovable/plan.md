
For luxury activities the "Booking Required" badge today drops users into a Viator search box (or nothing). When we already have the venue's official website from Google Places enrichment, we should send the user straight there with a clear, branded CTA. Viator becomes a *secondary* fallback, never the only option.

## Root cause

In `src/components/booking/InlineBookingActions.tsx` MODE 2 (`not_selected` + `vendor_booking`):
- We pass `actualBookingUrl = activity.externalBookingUrl || activity.bookingUrl || activity.website` into `VendorBookingLink`.
- But `VendorBookingLink.detectVendorFromUrl` (`src/components/booking/VendorBookingLink.tsx:78–84`) treats *any unknown host* as "viator" → button label reads **"View on Viator"** even when the underlying URL is `louvre.fr` / `septime-charonne.fr`.
- When no direct URL exists, the same component generates a hash-bucketed Viator/GetYourGuide *search query* — exactly the "budget-oriented fallback" the user is complaining about.

## Fix

### 1. Promote official-site CTA in `InlineBookingActions.tsx`

In MODE 2 / `not_selected` (lines ~424–446), branch BEFORE falling to `VendorBookingLink`:

```tsx
// New: prefer official venue site
const officialUrl = activity.website || activity.externalBookingUrl || activity.bookingUrl;
const isOTA = officialUrl && /viator\.com|getyourguide\.com|tripadvisor\.com|tiqets\.com|klook\.com|booking\.com/i.test(officialUrl);

if (officialUrl && !isOTA) {
  return (
    <OfficialBookingLink url={officialUrl} estimatedPrice={price} currency={activity.currency} />
  );
}
```

`OfficialBookingLink` (new tiny component, same file or sibling): renders a primary-tinted button **"Reserve on {hostname}"** (e.g. "Reserve on louvre.fr"), `ExternalLink` icon, optional `~price` on desktop. Uses `new URL(url).hostname.replace(/^www\./,'')` for label.

### 2. Fix vendor detection + label fallback in `VendorBookingLink.tsx`

`detectVendorFromUrl` currently returns `'viator'` for unknown hosts — change so unknown hosts return `null` and the button label falls back to **"Reserve on {hostname}"** instead of "View on Viator". This makes the existing component honest even where it's still in the path.

### 3. Replace Viator-only search fallback with concierge-led lookup

When there is NO direct URL AND NO Viator product (current line 425+ branch with `canShowViatorLink`), instead of `VendorBookingLink` doing a Viator search, render:

```tsx
<button onClick={() => onAskConcierge?.('Find me the official reservation link for ' + activity.title)}>
  <Sparkles /> Find official booking link
</button>
```

Plus a small text link: "or browse tours" → opens GetYourGuide search (not Viator) as a secondary option, since the user is for-luxury looking for unique experiences not the typical Viator catalogue.

The concierge prompt routes through the existing AI Concierge sheet (`onAskConcierge` prop already exists on the row — wire it through `InlineBookingActions` props).

### 4. Server-side defensive: surface Places website on `bookingUrl` when no Viator match

In `supabase/functions/generate-itinerary/venue-enrichment.ts` ~line 691: when `venueData.website` is set AND there was no Viator match, also copy it to `(enriched as any).bookingUrl` so any downstream code that only reads `bookingUrl` still gets a real link. Keep `website` separate for the "official site" check above.

```ts
if (venueData.website) {
  enriched.website = venueData.website;
  if (!(enriched as any).bookingUrl && !(enriched as any).viatorProductCode) {
    (enriched as any).bookingUrl = venueData.website;
  }
}
```

### 5. Memory

Add `mem://features/booking/booking-cta-priority` describing the priority chain:
**Viator-API product → Official venue site (Places `website`) → Concierge lookup → GetYourGuide search (last resort).**

## Files

- `src/components/booking/InlineBookingActions.tsx` — promote official-site CTA, replace Viator search fallback with concierge prompt + GYG secondary link, add `onAskConcierge` prop
- `src/components/booking/VendorBookingLink.tsx` — fix `detectVendorFromUrl` to return `null` for unknown hosts; new "Reserve on {hostname}" label fallback
- `src/components/itinerary/EditorialItinerary.tsx` — pass `onAskConcierge` callback through to `InlineBookingActions` (use existing concierge open handler)
- `supabase/functions/generate-itinerary/venue-enrichment.ts` — copy Places website into `bookingUrl` when no Viator match
- `mem://features/booking/booking-cta-priority` — new memory + index entry

## Out of scope

- No new affiliate program signup or commission rework.
- Hotel/flight booking flows untouched (already use Booking.com / direct vendor).
- Existing Viator-API-bookable items (with productCode) keep current "Book Now" instant flow — we only change the *fallback* path.

Approve?
