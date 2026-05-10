## RS.M8 — post-trip-email URLs from env

Replace the hardcoded `voyance-travel-planner.lovable.app` URLs in `supabase/functions/post-trip-email/index.ts` with a `SITE_URL` resolved from env, falling back to `SITE_DOMAIN`, then `travelwithvoyance.com`.

### Changes

**`supabase/functions/post-trip-email/index.ts`**

1. Near the top of the request handler (above the `generatePostTripEmailHtml` call, ~line 164), add:
   ```ts
   const SITE_URL = Deno.env.get('SITE_URL')
     ?? `https://${Deno.env.get('SITE_DOMAIN') ?? 'travelwithvoyance.com'}`;
   ```
2. Lines 170–171 — swap the literals:
   ```ts
   feedbackUrl: `${SITE_URL}/trips/${tripId}/feedback`,
   archivesUrl: `${SITE_URL}/trips/${tripId}`,
   ```

No other call sites in the function reference the old domain. CORS, auth, and email sending logic are untouched.

### Env

- `SITE_URL` is optional. If unset, the function uses `SITE_DOMAIN` (already shipped) or finally `travelwithvoyance.com`. No secret addition is required for this task; user can add `SITE_URL` later if they want to override.

### Verification

- `grep -c "Deno.env.get('SITE_URL')" supabase/functions/post-trip-email/index.ts` ≥ 1.
- No remaining occurrences of `voyance-travel-planner.lovable.app` in the file.

### Out of scope

- Auditing other edge functions for the same hardcoded domain (separate sweep).
- Adding the `SITE_URL` secret — fallback chain makes it optional.
