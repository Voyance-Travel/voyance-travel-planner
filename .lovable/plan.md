## Fix typo: `user.id` → `userId` in itinerary-chat:815

One-character fix. Line 815 of `supabase/functions/itinerary-chat/index.ts` references `user.id`, but the in-scope variable is `userId` (declared at line 465 as `let userId`). `user` is not defined in this scope, so the call would throw `ReferenceError` whenever the `structured` branch is hit.

### Change

```ts
// Before
await upsertDayIntents(serviceSupabase, itineraryContext.tripId, user.id, [structured]);

// After
await upsertDayIntents(serviceSupabase, itineraryContext.tripId, userId, [structured]);
```

No other call sites to update.
