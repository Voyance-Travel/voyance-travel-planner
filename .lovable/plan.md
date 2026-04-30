You’re right to challenge this. The honest answer: the previous attempts were mostly “we added tracking where we noticed calls,” not “we made it impossible to bypass tracking.” That is why the issue kept coming back.

What is different now is that we have the start of a centralized Google gateway, but my audit shows it is not fully closed yet. There are still allowlisted photo paths where Google photo downloads can happen without being attributed to the same cost tracker. That means the current state is better than before, but I would not call it leak-proof yet.

The actual fix is to move from best-effort accounting to enforced accounting.

```text
Before:
Many backend functions could call Google directly
        ↓
Some remembered to increment cost counters
        ↓
Invoice > internal estimate

Needed final state:
Every Google request must pass one gateway
        ↓
Gateway always records SKU + trip/user/action + audit metadata
        ↓
Raw Google URLs are never returned to the browser
        ↓
CI fails if a new bypass appears
        ↓
Internal report reconciles with invoice
```

## What still worries me in the current code

1. The lint guard exists, but it still has an allowlist.
   - Allowlist means “known exceptions are permitted.”
   - That is not the same as “no bypass is possible.”

2. Several photo-cache callers still do not pass an explicit cost tracker.
   - `hotels`
   - `recommend-restaurants`
   - `fetch-reviews`
   - a couple of `destination-images` healing/persistence paths
   - The shared photo cache warns when this happens, but warning is not enough. It can still under-report.

3. Some files still build raw Google photo URLs and hand them to the photo cache.
   - This is safer than returning the URL to the browser, but it is still a fragile pattern.
   - The stronger fix is: callers pass a Google photo resource id, and one gateway downloads + accounts + stores it.

4. The spend view exists, but it only becomes trustworthy after every billable path is forced through the gateway.

## The fix I recommend now

### 1. Remove “optional” Google photo accounting
Make photo downloads require attribution when the URL is Google-owned.

- If `getCachedPhotoUrl()` receives a `places.googleapis.com` or `maps.googleapis.com` URL without a cost tracker, it should not silently continue.
- It should either:
  - require a tracker, or
  - create and save a lazy tracker automatically, the same way the Google API gateway does.

This changes the behavior from “warn and lose accounting” to “accounting always happens.”

### 2. Thread explicit trackers through all remaining photo callers
Update remaining call sites so hotel, restaurant, review, and destination image photo downloads are attributed to the correct action/trip/user.

Targets:
- `hotels`
- `recommend-restaurants`
- `fetch-reviews`
- `destination-images` cache healing paths

### 3. Replace raw Google photo URL construction
Move Google Places photo downloads behind one helper.

Instead of this pattern:

```text
construct https://places.googleapis.com/.../media?key=...
pass URL to cache helper
```

Use this pattern:

```text
pass photo resource id to Google photo helper
helper records places_photo SKU
helper downloads bytes
helper stores image internally
caller only receives internal CDN/storage URL
```

This prevents repeated browser-side Google photo billing and removes key-bearing URLs from business logic.

### 4. Shrink the lint allowlist to zero or near-zero
The guard should fail on any direct `googleapis.com` reference except the one shared Google gateway file.

If a file needs to check whether a URL is Google-owned, it should use a shared predicate like:

```text
isGoogleBillableUrl(url)
```

That avoids keeping literal `googleapis.com` strings scattered across feature code.

### 5. Add a second guard for missing photo attribution
The current guard catches direct Google URL references. It does not catch this bug class:

```text
getCachedPhotoUrl(...googleUrl...) with no tracker
```

Add a test that fails when a Google photo cache call lacks an explicit tracker or approved lazy-tracker context.

### 6. Add reconciliation queries/admin visibility
Keep the existing spend-per-trip view, then add a practical reconciliation query/report by:

- day
- action type
- SKU
- trip id
- user id
- tracking record count

This lets us answer: “Why did Google bill $X yesterday?” instead of guessing.

## Why this is actually different

The difference is not “more tracking.” The difference is enforcement:

- No direct Google calls allowed.
- No untracked Google photo downloads allowed.
- No raw Google image URLs returned to clients.
- CI fails if someone adds a bypass.
- Spend is aggregated from the same table every gateway write uses.

That is how this stops being a recurring cleanup task and becomes a system-level invariant.

## Success criteria

I would consider the Google leak fixed only when all of these are true:

1. Search shows no raw Google API fetches outside the shared gateway/photo-storage internals.
2. The lint allowlist is empty or contains only non-billable string predicates moved to a shared utility.
3. Every Google Places photo cache miss records a `places_photo` SKU, even if a caller forgets a tracker.
4. No backend function returns a key-bearing Google photo URL to the frontend.
5. Tests fail if a future developer bypasses the gateway.
6. The spend report can show daily Google usage by SKU and action.

If approved, I’ll implement this final hardening pass and treat the remaining allowlist/missing-tracker items as blockers, not “low priority.”