## M6 — Reviews moderation guard (client-side auth gate)

**File:** `src/services/reviewsAPI.ts` (lines 155–163)

### Reality check vs spec

The user's snippet assumes `CreateReviewInput` carries a `userId` field and that `createReview` calls `fetch` directly. The actual code (lines 86–97, 155–164) differs:

- `CreateReviewInput` has **no `userId` field** — the server derives it from the JWT `sub`. So the spec's `input = { ...input, userId: session.user.id }` override is a no-op against the real type and would introduce an untyped property. **Skip that line.**
- `createReview` doesn't call `fetch` directly; it goes through `apiRequest`, which already pulls the access token via `getAuthToken()` and throws `'Authentication required. Please sign in.'` when no token is present (lines 27–31).

So the only meaningful gap vs the spec is a **friendlier, review-specific error message and an explicit early gate** (so callers don't see the generic auth error and so the bad request never even forms the headers). The DB-side enforcement and the server-side JWT verification are out of scope for this codebase, as the spec already notes.

### Plan

1. **Add an explicit session gate at the top of `createReview`** (before `apiRequest`). Use `supabase.auth.getSession()`, throw a review-specific message:

   ```ts
   export async function createReview(input: CreateReviewInput): Promise<Review> {
     // Auth gate: require a valid session before creating a review.
     // The server (and DB RLS upstream) is the source of truth for identity —
     // it derives userId from the JWT `sub`. This client-side guard prevents
     // the request from leaving the browser at all and surfaces a clearer
     // copy than the generic apiRequest auth error.
     const { data: { session } } = await supabase.auth.getSession();
     if (!session?.user?.id) {
       throw new Error('Sign in required to leave a review.');
     }

     const response = await apiRequest<{ status: string; review: Review }>(
       API_BASE,
       { method: 'POST', body: JSON.stringify(input) },
     );
     return response.review;
   }
   ```

2. **Do NOT** add `userId` to `CreateReviewInput` or override it in the body. The server reads identity from the JWT — adding `userId` to the POST body would either be ignored (best case) or open a trust-the-client surface (worst case). Trust-the-JWT is already the contract.

3. **No changes** to `getReviews`, `voteReview`, `updateReview`, `deleteReview`, `getReviewStats`, hooks, or types.

4. **Out of scope** (server-side, as the user's spec acknowledges):
   - JWT verification on `api.voyance.travel` / `voyance-backend.railway.app`.
   - Rejecting any client-supplied `userId` in the body.

### Verification

- A signed-out user clicking "Submit review" → toast/error reads "Sign in required to leave a review." (instead of the generic "Authentication required. Please sign in.").
- A signed-in user → unchanged behavior; one extra `getSession()` call (already cached by the supabase client).
- `grep -n "Sign in required to leave a review" src/services/reviewsAPI.ts` → 1 hit.
- Type check: `CreateReviewInput` unchanged → no downstream type breaks.
