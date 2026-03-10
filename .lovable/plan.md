

## Fix: Regeneration Duplicates Locked Activities

### Problem
When regenerating a day with locked activities, duplicates appear because:
1. The AI prompt says "don't overlap time slots" but doesn't say "don't generate similar activities" — so it creates a "Stand-Up Comedy Night" when "Comedy Show" is already locked
2. The post-generation filter (line 8307-8325) only checks **time overlap**, not **semantic similarity** — so near-miss times pass through
3. The must-do backfill (line 8520) checks only `generatedDay.activities` for existing events, but locked activities aren't merged until later (line 8328) — so backfill injects duplicates of locked must-dos

### Three Changes (all in `supabase/functions/generate-itinerary/index.ts`)

**Change 1: Strengthen the AI prompt** (line 6614-6623)

Add explicit instruction not to generate activities similar in *type/category* to locked ones. Currently it only says "don't overlap time slots." Add:
```
Do NOT generate any activity that is similar in type or theme to a locked activity.
For example, if "Comedy Show" is locked, do NOT suggest "Stand-Up Night" or any other comedy activity.
```

**Change 2: Add semantic dedup to the post-generation filter** (after line 8325, before line 8327)

After the existing time-overlap filter, add a second pass that removes generated activities whose titles are semantically similar to any locked activity (using the same keyword-matching logic already used in the must-do backfill at line 8537-8543):

```typescript
// Semantic dedup: remove generated activities that are title-similar to locked ones
normalizedActivities = normalizedActivities.filter((genAct) => {
  const genTitle = (genAct.title || '').toLowerCase();
  for (const locked of lockedActivities) {
    const lockedTitle = (locked.title || '').toLowerCase();
    // Substring match
    if (genTitle.includes(lockedTitle) || lockedTitle.includes(genTitle)) {
      console.log(`[generate-day] Removing "${genAct.title}" — duplicate of locked "${locked.title}"`);
      return false;
    }
    // Keyword match (50% threshold)
    const keywords = lockedTitle.replace(/\b(the|a|an|at|in|on|for|and|or|to|of)\b/g, '').split(/\s+/).filter(w => w.length > 2);
    if (keywords.length > 0) {
      const matchCount = keywords.filter(kw => genTitle.includes(kw)).length;
      if (matchCount >= Math.ceil(keywords.length * 0.5) && matchCount >= 1) {
        console.log(`[generate-day] Removing "${genAct.title}" — semantic duplicate of locked "${locked.title}"`);
        return false;
      }
    }
  }
  return true;
});
```

**Change 3: Must-do backfill checks locked activities** (after line 8547, before line 8549)

Before injecting a backfill card, check if the must-do is already present as a locked activity:

```typescript
// Check if this must-do is already locked on the day
const eventIsLocked = lockedActivities.some((locked) => {
  const lockedTitle = (locked.title || '').toLowerCase();
  if (lockedTitle.includes(eventTitleLower) || eventTitleLower.includes(lockedTitle)) return true;
  if (coreKeywords.length > 0) {
    const matchCount = coreKeywords.filter(kw => lockedTitle.includes(kw)).length;
    if (matchCount >= Math.ceil(coreKeywords.length * 0.5) && matchCount >= 1) return true;
  }
  return false;
});
if (eventIsLocked) {
  console.log(`[generate-day] Skipping must-do backfill "${eventItem.priority.title}" — already locked`);
  continue;
}
```

### Summary
- **Change 1**: Tell AI not to generate similar activities (prompt improvement)
- **Change 2**: Safety net — strip semantically similar generated activities before merge (code filter)
- **Change 3**: Prevent must-do backfill from duplicating locked activities (backfill check)

All changes are in a single file. No new files or dependencies needed.

