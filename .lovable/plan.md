

## Fix Missing Collaborator Attribution Dots on Full Days

### Problem
The collaborator attribution dots show on Day 1 and Day 3 but not Day 2. Database confirms: trip `81fd33e2` has `suggestedFor` populated on 6/7 activities for Day 1, 0/7 for Day 2, and 6/6 for Day 3. The AI inconsistently generates the field. Additionally, most multi-traveler trips have ZERO `suggestedFor` across ALL days because the code only queries `trip_collaborators` and not `trip_members`.

### Root Causes
1. **No post-generation guarantee**: Check-in and checkout have deterministic backfill when the AI omits them. `suggestedFor` has no such guarantee — it relies entirely on the AI following the prompt, which it fails to do on some days.
2. **Incomplete participant loading**: Both the `generate-day` handler (line 8092) and Stage 2 (line 4318) only query `trip_collaborators`. Travelers added via `trip_members` are invisible to the attribution system.

### Fix Plan

**File: `supabase/functions/generate-itinerary/index.ts`**

**Change 1 — Query both tables for `generate-day` handler (~line 8090-8125):**
- Replace the single `trip_collaborators` query with a parallel query of both `trip_collaborators` and `trip_members`
- Merge unique user IDs from both tables (excluding the owner who's already included)
- Build the attribution prompt from the merged list
- Store `allUserIds` in a variable accessible to the post-generation guarantee

**Change 2 — Query both tables for Stage 2 (~line 4317-4345):**
- Same parallel query pattern for `trip_collaborators` + `trip_members`
- Merge IDs before building `context.collaboratorTravelers`

**Change 3 — Add `suggestedFor` post-generation guarantee (~after line 9400, after the checkout guarantee):**
When the trip has multiple travelers (allUserIds.length > 1), iterate through all generated activities. For any activity missing `suggestedFor`:
- Use round-robin assignment across all traveler IDs
- Skip transport/transit activities (assign all travelers comma-separated since transport is shared)
- This guarantees every activity has a `suggestedFor` value even when the AI omits it

```text
Logic:
1. Only runs when allUserIds.length > 1
2. For each activity without suggestedFor:
   - If transport/transit category → assign all user IDs comma-separated
   - Otherwise → round-robin assign individual user IDs
3. Log count of backfilled activities
```

This mirrors the check-in/checkout guarantee pattern: the AI prompt asks for the right behavior, and the post-generation guarantee catches omissions deterministically.

