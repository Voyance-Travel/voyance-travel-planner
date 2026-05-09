## M9 — Reviews cache key invalidation in `useCreateReview`

File: `src/services/reviewsAPI.ts`, lines 304–310 (the `onSuccess` of `useCreateReview`).

### Current behavior

```ts
onSuccess: (review) => {
  queryClient.invalidateQueries({ queryKey: reviewKeys.activity(review.activityId) });
  queryClient.invalidateQueries({ queryKey: reviewKeys.stats(review.activityId) });
  if (review.destinationId) {
    queryClient.invalidateQueries({ queryKey: reviewKeys.destination(review.destinationId) });
  }
  toast.success('Review submitted successfully!');
},
```

If `review.activityId` is null/undefined, the activity/stats keys become `[...all, 'activity', '']` — invalidating phantom keys and missing UI surfaces that read unfiltered review lists (e.g. `reviewKeys.list`, `reviewKeys.user`).

### Edit

Replace the `onSuccess` body with:

```ts
onSuccess: (review) => {
  // Always invalidate the broad reviews key — catches null-activityId paths
  // and any UI surface that reads reviews without filtering by activity.
  queryClient.invalidateQueries({ queryKey: reviewKeys.all });

  // Also invalidate the specific activity/stats keys when present, so
  // per-activity panels refetch immediately.
  if (review.activityId) {
    queryClient.invalidateQueries({ queryKey: reviewKeys.activity(review.activityId) });
    queryClient.invalidateQueries({ queryKey: reviewKeys.stats(review.activityId) });
  }
  if (review.destinationId) {
    queryClient.invalidateQueries({ queryKey: reviewKeys.destination(review.destinationId) });
  }
  if (review.userId) {
    queryClient.invalidateQueries({ queryKey: reviewKeys.user(review.userId) });
  }

  toast.success('Review submitted successfully!');
},
```

`reviewKeys.all` is the prefix of every other key, so the targeted invalidations after it are technically redundant — kept per spec for explicit per-surface refetch signaling and for the `userId` path the spec adds.

### Note

User's snippet didn't include the existing `stats` and `destination` invalidations; preserved both so existing review-stats and destination panels still refresh.

### Verification

```bash
grep -c "reviewKeys.all\|reviewKeys.user" src/services/reviewsAPI.ts   # ≥ 2 (was 3 already; will be ≥ 5)
```

No deploy needed (frontend-only change).